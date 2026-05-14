// Room code validator + normaliser — split out from `lib/rooms.ts`
// so client components can import it without dragging the DB client
// through the bundler. (lib/rooms also exposes server-only helpers
// that import drizzle + postgres-js, which Next refuses to bundle
// for the browser.)
//
// Six-character codes from an unambiguous alphabet. The generator
// (server-side, in lib/rooms.ts) uses [23456789A-HJ-NP-Z]; the
// validator additionally allows `1` so a host can type a memorable
// custom code like "PARTY1" without rejecting it. 0/O and I/L stay
// out — visually indistinguishable.
export const ROOM_CODE_REGEX = /^[1-9ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_REGEX.test(code);
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}
