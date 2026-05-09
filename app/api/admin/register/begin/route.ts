import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import {
  ADMIN_RP_NAME,
  getRpId,
  readAdminSession,
} from "@/lib/admin/session";

// Phase 1 of passkey enrollment. Authorization model (TOFU — trust on first
// use):
//   - If NO credentials exist yet → the next caller gets to enroll, no
//     secret required. Lock down /admin/login behind something like Vercel
//     Password Protection if you're worried about a window.
//   - If credentials already exist → caller must already be authed (i.e.
//     they signed in with an existing passkey first). This is the
//     "add a backup device" flow from /admin/settings.
export async function POST(request: Request) {
  try {
    if (!process.env.ADMIN_SESSION_SECRET) {
      return NextResponse.json(
        {
          error:
            "ADMIN_SESSION_SECRET is not configured on the server. Set it in your Vercel project env vars (≥32 chars) and redeploy.",
        },
        { status: 503 },
      );
    }

    const existing = await db
      .select({ id: adminCredentials.id })
      .from(adminCredentials);
    const session = await readAdminSession();

    if (existing.length > 0 && !session.authed) {
      return NextResponse.json(
        { error: "Sign in with an existing passkey first." },
        { status: 401 },
      );
    }

    const userId = session.webauthnUserId ?? crypto.randomUUID();

    const options = await generateRegistrationOptions({
      rpName: ADMIN_RP_NAME,
      rpID: getRpId(request),
      userID: new TextEncoder().encode(userId),
      userName: "admin",
      userDisplayName: "Eurovision 2026 admin",
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "preferred",
        residentKey: "preferred",
      },
      excludeCredentials: existing.map((c) => ({ id: c.id })),
    });

    session.challenge = options.challenge;
    session.challengeKind = "register";
    session.webauthnUserId = userId;
    await session.save();

    return NextResponse.json(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/register/begin]", err);
    return NextResponse.json(
      { error: `Enrollment setup failed: ${message}` },
      { status: 500 },
    );
  }
}
