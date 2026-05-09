import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import {
  getOrigin,
  getRpId,
  readAdminSession,
} from "@/lib/admin/session";

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session.challenge || session.challengeKind !== "login") {
    return NextResponse.json(
      { error: "No login challenge in session" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { assertion: Parameters<typeof verifyAuthenticationResponse>[0]["response"] }
    | null;
  if (!body?.assertion) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const credentialId = body.assertion.id;

  const [stored] = await db
    .select()
    .from(adminCredentials)
    .where(eq(adminCredentials.id, credentialId))
    .limit(1);

  if (!stored) {
    return NextResponse.json({ error: "Unknown credential" }, { status: 401 });
  }

  const verification = await verifyAuthenticationResponse({
    response: body.assertion,
    expectedChallenge: session.challenge,
    expectedOrigin: getOrigin(request),
    expectedRPID: getRpId(request),
    credential: {
      id: stored.id,
      publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64url")),
      counter: stored.counter,
      transports: stored.transports
        ? (stored.transports.split(",") as ("usb" | "nfc" | "ble" | "internal" | "hybrid")[])
        : undefined,
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  await db
    .update(adminCredentials)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: sql`now()`,
    })
    .where(eq(adminCredentials.id, credentialId));

  session.authed = true;
  session.challenge = undefined;
  session.challengeKind = undefined;
  await session.save();

  return NextResponse.json({ ok: true });
}
