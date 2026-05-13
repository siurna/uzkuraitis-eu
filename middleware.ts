import { NextResponse, type NextRequest } from "next/server";

// Edge-runtime middleware: gates direct navigation to /r/<code> on the
// Turnstile join cookie. Anyone deep-linking without having cleared the
// challenge gets bounced to /?code=<code>, where RoomGate renders the
// Turnstile widget, POSTs to /api/rooms/verify-join, and (on success)
// receives the cookie + a redirect back here.
//
// Skipped entirely when TURNSTILE_SECRET_KEY isn't configured (dev),
// and when the path is /r/<code>/manage (the host-link admin page — the
// admin token in the URL is the auth there, no Turnstile needed).

const ROOM_PATH = /^\/r\/([A-Za-z0-9]{6})(\/|$)/;
const JOIN_COOKIE_PREFIX = "uzk_j_";

export function middleware(req: NextRequest) {
  if (!process.env.TURNSTILE_SECRET_KEY) return NextResponse.next();

  const path = req.nextUrl.pathname;
  const m = ROOM_PATH.exec(path);
  if (!m) return NextResponse.next();
  // The magic-link admin page authenticates by token in the query
  // string; Turnstile would just be a speed bump for the host.
  if (path.startsWith(`/r/${m[1]}/manage`)) return NextResponse.next();

  const code = m[1].toUpperCase();
  const cookie = req.cookies.get(`${JOIN_COOKIE_PREFIX}${code}`)?.value;
  if (cookie === "1") return NextResponse.next();

  const target = new URL("/", req.nextUrl);
  target.searchParams.set("code", code);
  return NextResponse.redirect(target);
}

// Limit matcher to /r/* so middleware doesn't run on every static asset
// request — meaningfully cheaper.
export const config = {
  matcher: ["/r/:path*"],
};
