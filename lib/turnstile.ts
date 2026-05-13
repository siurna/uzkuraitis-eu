// Cloudflare Turnstile verification. Stops botnet drive-bys at the
// room-join screen — one challenge per device per room, mostly
// invisible (Cloudflare uses passive signals first and only shows a
// puzzle if signals are weird). Pure human attackers solve the
// challenge and continue; the signed-session cookie + DB rate limits
// catch them downstream.
//
// Required env vars in production:
//   NEXT_PUBLIC_TURNSTILE_SITE_KEY  — public site key for the widget
//   TURNSTILE_SECRET_KEY            — server-side verify secret
//
// Without TURNSTILE_SECRET_KEY the verify helper passes everything (dev
// mode); the middleware that gates /r/<code> also bypasses entirely so
// local development isn't hostile.

const VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export function turnstileSiteKey(): string | null {
  // Inlined at build time by Next — guarded so a missing public key
  // doesn't crash the client.
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return key && key.length > 0 ? key : null;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dev / unconfigured → bypass
  if (!token) return false;
  const params = new URLSearchParams({ secret, response: token });
  if (remoteIp) params.set("remoteip", remoteIp);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}
