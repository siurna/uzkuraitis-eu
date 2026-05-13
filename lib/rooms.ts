import { customAlphabet } from "nanoid";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { rooms, type Room } from "./db/schema";

// Six-character codes from an unambiguous alphabet (no 0/O/I/L). The
// auto-generator skips ambiguous chars; the validator additionally
// allows `1` so a host can type a memorable custom code like "PARTY1"
// (we draw the line at characters that are visually indistinguishable
// from each other: 0/O, I/L).
const ROOM_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const generateCode = customAlphabet(ROOM_CODE_ALPHABET, 6);

// 32-char URL-safe token for the per-room admin link. Long enough to be
// unguessable, short enough to fit in a share link without ugly wrapping.
const ADMIN_TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const generateAdminToken = customAlphabet(ADMIN_TOKEN_ALPHABET, 32);

// Validator alphabet: the generator's set + `1`. Hosts typing a custom
// code can include digits; the generator stays conservative.
export const ROOM_CODE_REGEX = /^[1-9ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

// Suggest a fresh code (uses the conservative auto-generator alphabet).
export function suggestRoomCode(): string {
  return generateCode();
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

// PERF: tiny per-warm-instance cache keyed on the upper-cased room
// code. Every API route that accepts a code does this lookup once
// (sometimes 2-3x in a single request when the route then reads
// derived data). Room props change rarely; a 5s TTL is invisible to
// admin updates (they trigger a Liveblocks broadcast that the client
// already reacts to) but lets a 30-client refetch fan-out hit memory
// instead of Postgres.
type CacheEntry = { room: Room; until: number };
const roomCache = new Map<string, CacheEntry>();
const ROOM_CACHE_TTL_MS = 5_000;

export async function findRoomByCode(code: string): Promise<Room | null> {
  const normalized = normalizeRoomCode(code);
  if (!isValidRoomCode(normalized)) return null;

  const now = Date.now();
  const hit = roomCache.get(normalized);
  if (hit && hit.until > now) return hit.room;

  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, normalized))
    .limit(1);

  if (room) {
    roomCache.set(normalized, { room, until: now + ROOM_CACHE_TTL_MS });
  }
  return room ?? null;
}

/** Bust the cache for a single room — call from the routes that just
 *  mutated the row so callers downstream don't read stale state. */
export function invalidateRoomCache(code: string): void {
  roomCache.delete(normalizeRoomCode(code));
}

export async function touchRoom(roomId: string): Promise<void> {
  await db
    .update(rooms)
    .set({ lastActiveAt: sql`now()` })
    .where(eq(rooms.id, roomId));
}

export async function createRoom(name: string, preferredCode?: string): Promise<Room | { error: "code_taken" } | { error: "code_invalid" }> {
  const normalizedPreferred = preferredCode ? normalizeRoomCode(preferredCode) : null;
  if (normalizedPreferred && !isValidRoomCode(normalizedPreferred)) {
    return { error: "code_invalid" };
  }
  const adminToken = generateAdminToken();

  // Caller-supplied code: try once, surface the conflict — don't silently
  // fall back to a random one, the admin asked for that specific code.
  if (normalizedPreferred) {
    try {
      const [room] = await db
        .insert(rooms)
        .values({
          code: normalizedPreferred,
          name: name.trim() || "Eurovision party",
          adminToken,
        })
        .returning();
      return room;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("rooms_code_unique") || message.includes("duplicate")) {
        return { error: "code_taken" };
      }
      throw err;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
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
  const result = await createRoom(fallbackName);
  if ("error" in result) {
    throw new Error(`createRoom failed: ${result.error}`);
  }
  return result;
}
