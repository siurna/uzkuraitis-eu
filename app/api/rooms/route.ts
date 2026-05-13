import { NextResponse } from "next/server";
import { z } from "zod";
import { createRoom } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";

const CreateRoomSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  /** Optional pre-chosen join code — must be 6 chars in the allowed set. */
  code: z.string().length(6).optional(),
});

export async function POST(request: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CreateRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const result = await createRoom(
    parsed.data.name ?? "Eurovision party",
    parsed.data.code,
  );
  if ("error" in result) {
    if (result.error === "code_taken") {
      return NextResponse.json({ error: "That code is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Codes are 6 characters: 1-9 and A-Z (no 0, I, L, O)." }, { status: 400 });
  }
  return NextResponse.json({
    id: result.id,
    code: result.code,
    name: result.name,
    // The host who creates the room gets the per-room admin token so they
    // can use the share-link admin flow (no global passkey needed). Only
    // the global admin (already authed above) sees this in the response.
    adminToken: result.adminToken,
  });
}
