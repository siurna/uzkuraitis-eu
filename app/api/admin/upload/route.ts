import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { isAdminAuthed } from "@/lib/admin/session";

// Generic admin file upload → Vercel Blob. Used for things like the
// live-commentator's photo. Admin session-gated. Needs
// BLOB_READ_WRITE_TOKEN in the environment.

const MAX_BYTES = 8 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploads aren't configured (no Blob store)." }, { status: 503 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  if (file.size === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 8 MB)" }, { status: 413 });

  const blob = await put(`admin/${nanoid(16)}.${ext}`, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });
  return NextResponse.json({ url: blob.url });
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;
