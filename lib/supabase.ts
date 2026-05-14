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
  try {
    const res = await fetch(`${URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
      body: JSON.stringify({
        messages: [{ topic: channel, event, payload }],
      }),
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      console.warn(
        `[supabase] broadcast ${event} → ${res.status}: ${await res.text()}`,
      );
    }
  } catch (err) {
    // Swallow — broadcasts are best-effort hints; the durable write
    // already committed and clients can poll/refresh on their own.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[supabase] broadcast failed", err);
    }
  }
}
