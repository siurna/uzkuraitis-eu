import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { isAdminAuthed } from "@/lib/admin/session";
import { uploadImage } from "@/lib/storage";

// Generic admin file upload → Supabase Storage `commentator` bucket.
// Used for the live-commentator photo. Admin session-gated. Needs
// NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the env.

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
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  if (file.size === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 8 MB)" }, { status: 413 });
  }

  try {
    const { url } = await uploadImage(
      "commentator",
      `${nanoid(16)}.${ext}`,
      await file.arrayBuffer(),
      file.type,
    );
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;
