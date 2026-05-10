import { customAlphabet } from "nanoid";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { rooms, type Room } from "./db/schema";

// Six-character codes from an unambiguous alphabet (no 0/O/1/I/L). Aim for
// codes you can read aloud at a watch party without typos.
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const generateCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

// 32-char URL-safe token for the per-room admin link. Long enough to be
// unguessable, short enough to fit in a share link without ugly wrapping.
const ADMIN_TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const generateAdminToken = customAlphabet(ADMIN_TOKEN_ALPHABET, 32);

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
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const adminToken = generateAdminToken();
    try {
      const [room] = await db
        .insert(rooms)
        .values({
          code,
          name: name.trim() || "Eurovision party",
          adminToken,
        })
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

// Per-room admin gate. Returns the room iff the supplied token matches
// the room's adminToken. Constant-time comparison via byte-equality of
// equal-length strings; any short-circuit on length mismatch is fine
// (different lengths are obviously different tokens).
export async function findRoomByCodeWithToken(
  code: string,
  token: string,
): Promise<Room | null> {
  const room = await findRoomByCode(code);
  if (!room) return null;
  if (!token || token.length !== room.adminToken.length) return null;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ room.adminToken.charCodeAt(i);
  }
  return mismatch === 0 ? room : null;
}

// Update the human-friendly join code. Returns null if the requested code
// is malformed or already taken by another room.
export async function changeRoomCode(
  roomId: string,
  nextCode: string,
): Promise<Room | null> {
  const normalized = normalizeRoomCode(nextCode);
  if (!isValidRoomCode(normalized)) return null;

  const [conflict] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.code, normalized), ne(rooms.id, roomId)))
    .limit(1);
  if (conflict) return null;

  const [updated] = await db
    .update(rooms)
    .set({ code: normalized })
    .where(eq(rooms.id, roomId))
    .returning();
  return updated ?? null;
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
