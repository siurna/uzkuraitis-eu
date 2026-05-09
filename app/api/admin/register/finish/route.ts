import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import {
  getOrigin,
  getRpId,
  readAdminSession,
} from "@/lib/admin/session";
import { z } from "zod";

const Body = z.object({
  label: z.string().min(1).max(60).default("Primary passkey"),
  attestation: z.unknown(), // SimpleWebAuthn registration response payload
});

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (
    !session.challenge ||
    session.challengeKind !== "register"
  ) {
    return NextResponse.json(
      { error: "No registration challenge in session" },
      { status: 400 },
    );
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    // SimpleWebAuthn's response shape isn't worth rewriting locally —
    // accept it as opaque and lean on the verifier.
    response: parsed.data.attestation as Parameters<
      typeof verifyRegistrationResponse
    >[0]["response"],
    expectedChallenge: session.challenge,
    expectedOrigin: getOrigin(request),
    expectedRPID: getRpId(request),
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  await db.insert(adminCredentials).values({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter ?? 0,
    transports: credential.transports?.join(",") ?? null,
    label: parsed.data.label,
  });

  // Sign the admin in immediately on first enrollment.
  session.authed = true;
  session.challenge = undefined;
  session.challengeKind = undefined;
  await session.save();

  return NextResponse.json({ ok: true });
}
