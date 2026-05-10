import { NextResponse } from "next/server";
import { z } from "zod";
import { createRoom } from "@/lib/rooms";
import { isAdminAuthed } from "@/lib/admin/session";

const CreateRoomSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
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

  const room = await createRoom(parsed.data.name ?? "Eurovision party");
  return NextResponse.json({
    id: room.id,
    code: room.code,
    name: room.name,
    // The host who creates the room gets the per-room admin token so they
    // can use the share-link admin flow (no global passkey needed). Only
    // the global admin (already authed above) sees this in the response.
    adminToken: room.adminToken,
  });
}
