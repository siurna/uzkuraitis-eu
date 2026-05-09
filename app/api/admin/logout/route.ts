import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/admin/session";

export async function POST() {
  const session = await readAdminSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
