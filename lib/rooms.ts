import { customAlphabet } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { rooms, type Room } from "./db/schema";

// Six-character codes from an unambiguous alphabet (no 0/O/1/I/L). Aim for
// codes you can read aloud at a watch party without typos.
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const generateCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

// Match the alphabet letter-for-letter so the validator can't accept a
// character the generator would never produce (the previous A-HJ-NP-Z
// range silently allowed L, which the generator excludes).
export function isValidRoomCode(code: string): boolean {
  return /^[2-9ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(code);
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function findRoomByCode(code: string): Promise<Room | null> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) return null;

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, normalized))
    .limit(1);

  return room ?? null;
}

export async function touchRoom(roomId: string): Promise<void> {
  await db
    .update(rooms)
    .set({ lastActiveAt: sql`now()` })
    .where(eq(rooms.id, roomId));
}

export async function createRoom(name: string): Promise<Room> {
  // Retry on the (extremely unlikely) collision with an existing code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const [room] = await db
        .insert(rooms)
        .values({ code, name: name.trim() || "Eurovision party" })
        .returning();
      return room;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("rooms_code_unique") && !message.includes("duplicate")) {
        throw err;
      }
    }
  }
  throw new Error("Failed to allocate a unique room code after 5 attempts");
}

export async function getOrCreateRoom(
  code: string | undefined,
  fallbackName = "Eurovision party",
): Promise<Room> {
  if (code) {
    const existing = await findRoomByCode(code);
    if (existing) return existing;
  }
  return createRoom(fallbackName);
}
