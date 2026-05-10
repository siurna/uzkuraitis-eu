import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { adminCredentials } from "@/lib/db/schema";
import { isAdminAuthed } from "@/lib/admin/session";

// Used by the /admin login page to render the right initial screen:
//   - bootstrapped=false → show bootstrap-secret prompt + register passkey
//   - bootstrapped=true, authed=false → show "tap to sign in"
//   - bootstrapped=true, authed=true  → redirect to /admin
export async function GET() {
  const credentials = await db
    .select({ id: adminCredentials.id })
    .from(adminCredentials);
  const authed = await isAdminAuthed();
  return NextResponse.json({
    bootstrapped: credentials.length > 0,
    authed,
  });
}
