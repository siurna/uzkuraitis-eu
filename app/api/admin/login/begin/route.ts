import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import { getRpId, readAdminSession } from "@/lib/admin/session";

export async function POST(request: Request) {
  const credentials = await db
    .select({ id: adminCredentials.id, transports: adminCredentials.transports })
    .from(adminCredentials);

  if (credentials.length === 0) {
    return NextResponse.json(
      {
        error: "No admin passkey registered yet.",
        code: "NOT_BOOTSTRAPPED",
      },
      { status: 409 },
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: getRpId(request),
    userVerification: "preferred",
    allowCredentials: credentials.map((c) => ({
      id: c.id,
      transports: c.transports
        ? (c.transports.split(",") as ("usb" | "nfc" | "ble" | "internal" | "hybrid")[])
        : undefined,
    })),
  });

  const session = await readAdminSession();
  session.challenge = options.challenge;
  session.challengeKind = "login";
  await session.save();

  return NextResponse.json(options);
}
