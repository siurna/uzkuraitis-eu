import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import {
  ADMIN_RP_NAME,
  getRpId,
  readAdminSession,
} from "@/lib/admin/session";

// Phase 1 of passkey enrollment. Authorization model:
//   - If NO credentials exist yet → caller must present ADMIN_BOOTSTRAP_SECRET
//     in the Authorization header. (Bootstrap.)
//   - If credentials already exist → caller must already be authed (i.e. they
//     signed in with an existing passkey first), so they can register a backup
//     device.
export async function POST(request: Request) {
  const existing = await db.select({ id: adminCredentials.id }).from(adminCredentials);

  const session = await readAdminSession();

  if (existing.length === 0) {
    const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
    if (!expected) {
      return NextResponse.json(
        {
          error:
            "Admin not bootstrapped and ADMIN_BOOTSTRAP_SECRET is not set on the server.",
        },
        { status: 503 },
      );
    }
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.replace(/^Bearer\s+/i, "");
    if (provided !== expected) {
      return NextResponse.json(
        { error: "Invalid bootstrap secret" },
        { status: 401 },
      );
    }
  } else if (!session.authed) {
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
    userDisplayName: "Užkuraitis admin",
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
}
