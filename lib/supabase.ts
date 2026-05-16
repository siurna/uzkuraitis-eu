import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Two singletons: a browser-side client (anon key) for realtime
// subscriptions + presence, and a server-side client (service-role
// key) used only inside API routes. Module-scope caching so we don't
// rebuild the underlying websocket every render / every invocation.

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;
  if (!URL || !ANON) {
    throw new Error(
      "Supabase realtime env is not set. Add NEXT_PUBLIC_SUPABASE_URL " +
        "and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel (Production + " +
        "Preview + Development).",
    );
  }
  browserClient = createClient(URL, ANON, {
    auth: { persistSession: false },
    realtime: {
      // Keep socket cap low — one shared connection per browser tab.
      // The realtime client multiplexes channels onto it.
      params: { eventsPerSecond: 20 },
    },
  });
  return browserClient;
}

// Server-side broadcast. We don't keep a long-lived websocket on the
// server — every invocation just POSTs to the Realtime REST endpoint
// with the service-role key. That's stateless, fits Lambda, and the
// service-role bypasses RLS (we don't gate the broadcast channel at
// row level anyway — hints are non-sensitive).
//
// Retries: on a retryable status (429 rate-limit, or 5xx server
// error) or a network throw we wait ~1s and try again, up to 3
// attempts total. Non-retryable failures (400/401/403/404) fail
// fast — those are bugs, not transient hiccups, and 3s of dead
// waiting hurts the route handler's response time for nothing.
// Broadcasts are best-effort hints so the final outcome is
// swallowed regardless; the retry is here so a momentary 429 from
// Supabase's per-project cap (~200 msgs/sec) doesn't silently drop
// a chat-new echo at climax.
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const BROADCAST_RETRIES = 3;
const BROADCAST_RETRY_DELAY_MS = 1_000;
// Per-attempt timeout on the broadcast fetch. Without this, a hung
// TLS handshake or a stalled connection to Supabase Realtime would
// block the calling route for the platform default (~30s on Vercel),
// which during a chat / vote storm means every Lambda invocation
// holds for the full timeout. 2s per attempt is more than enough
// for the round-trip (typically &lt;200ms) and keeps the worst-case
// add-on at the route handler under ~7s (3 attempts × 2s + 2 ×
// retry delay) instead of ~95s.
const BROADCAST_TIMEOUT_MS = 2_000;

async function attemptBroadcast(
  url: string,
  serviceRole: string,
  body: string,
): Promise<Response | null> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
      body,
      signal: AbortSignal.timeout(BROADCAST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

export async function serverBroadcast(
  channel: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !serviceRole) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[supabase] skipping broadcast: SUPABASE_SERVICE_ROLE_KEY missing.",
      );
    }
    return;
  }

  const body = JSON.stringify({
    messages: [{ topic: channel, event, payload }],
  });
  const url = `${URL}/realtime/v1/api/broadcast`;

  for (let attempt = 1; attempt <= BROADCAST_RETRIES; attempt++) {
    const res = await attemptBroadcast(url, serviceRole, body);
    if (res?.ok) return;
    if (res && !RETRYABLE_STATUSES.has(res.status)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[supabase] broadcast ${event} → ${res.status} (non-retryable): ${await res.text()}`,
        );
      }
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[supabase] broadcast ${event} attempt ${attempt}/${BROADCAST_RETRIES} failed (${res?.status ?? "network/abort"})`,
      );
    }
    if (attempt < BROADCAST_RETRIES) {
      await new Promise((r) => setTimeout(r, BROADCAST_RETRY_DELAY_MS));
    }
  }
  // All attempts exhausted — swallow. The durable write already
  // committed, and clients have reconnect-driven catch-up that will
  // pick up the missed event on the next refetch trigger.
}
