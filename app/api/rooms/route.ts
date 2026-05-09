import { NextResponse } from "next/server";
import { z } from "zod";
import { createRoom } from "@/lib/rooms";

const CreateRoomSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
});

export async function POST(request: Request) {
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
  });
}
