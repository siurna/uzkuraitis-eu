import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { findRoomByCode } from "@/lib/rooms";
import { guardAnySession, readSignedSessionId } from "@/lib/server-session";
import { checkAndIncrement } from "@/lib/rate-limit";

// Image upload for chat. Accepts a multipart form ("file") or a raw
// image body, validates type + size, drops it in the Blob store and
// returns the public URL. The client then posts a normal chat message
// with kind:"image" and gifUrl set to that URL.
//
// Needs BLOB_READ_WRITE_TOKEN in the environment (Vercel Blob store).

type RouteCtx = { params: Promise<{ code: string }> };

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const OK_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request, { params }: RouteCtx) {
  const { code } = await params;
  const room = await findRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const guard = await guardAnySession();
  if (guard) return guard;

  // 30 uploads per session per hour. Keeps blob storage costs bounded
  // even if a room code leaks and a guest decides to be hostile.
  const session = await readSignedSessionId();
  if (session) {
    const rl = await checkAndIncrement(
      `upload:${room.id}:${session}`,
      30,
      60 * 60 * 1000,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Upload limit reached — try again in an hour." },
        { status: 429 },
      );
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Image uploads aren't configured." },
      { status: 503 },
    );
  }

  // Pull the file out of either a multipart form or the raw request body.
  let data: ArrayBuffer;
  let type: string;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    type = file.type;
    data = await file.arrayBuffer();
  } else {
    type = ct.split(";")[0].trim();
    data = await req.arrayBuffer();
  }

  if (!OK_TYPES.has(type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  }
  if (data.byteLength === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }
  if (data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 8 MB)" }, { status: 413 });
  }

  const key = `chat/${room.id}/${nanoid(16)}.${EXT[type]}`;
  const blob = await put(key, data, {
    access: "public",
    contentType: type,
    addRandomSuffix: false,
  });

  return NextResponse.json({ url: blob.url });
}

export const dynamic = "force-dynamic";
// Allow up to ~10MB request bodies for the raw-body path.
export const maxDuration = 30;
