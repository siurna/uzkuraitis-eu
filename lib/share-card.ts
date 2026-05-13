// Share / copy the voter's TOP10 card (the OG-rendered PNG at
// /api/og/<roomCode>/<voterId>). On mobile, hand the actual image file
// to the native share sheet (drop straight into Instagram / Messages);
// on desktop, copy the PNG to the clipboard; otherwise just open it.
//
// The image is generated on demand by the OG route, so the caller should
// show a "preparing…" state around this call — it can take a second.

export type ShareResult = "shared" | "clipboard" | "opened";

const TEST_PNG = () => new File([], "x.png", { type: "image/png" });

export async function shareTopTen(opts: {
  roomCode: string;
  voterId: string;
  caption: string;
  lang?: "en" | "lt";
}): Promise<ShareResult> {
  const url = `${window.location.origin}/api/og/${opts.roomCode}/${opts.voterId}${
    opts.lang ? `?lang=${opts.lang}` : ""
  }`;

  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [TEST_PNG()] });

  if (canShareFiles) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`og ${res.status}`);
    const blob = await res.blob();
    try {
      await navigator.share({
        files: [new File([blob], "eurovision-top10.png", { type: "image/png" })],
        text: opts.caption,
      });
      return "shared";
    } catch (e) {
      // User dismissed the sheet — that's fine, not a failure.
      if ((e as Error)?.name === "AbortError") return "shared";
      // Couldn't share the file (some in-app browsers) — fall back to the
      // clipboard with the blob we've already got.
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        return "clipboard";
      }
      throw e;
    }
  }

  // Desktop: copy the PNG. Hand the fetch promise straight to
  // ClipboardItem so the write stays inside the user gesture (Safari is
  // strict about an `await` before clipboard.write).
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard?.write &&
    typeof ClipboardItem !== "undefined"
  ) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": fetch(url, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`og ${r.status}`);
          return r.blob();
        }),
      }),
    ]);
    return "clipboard";
  }

  // Last resort.
  window.open(url, "_blank", "noopener,noreferrer");
  return "opened";
}
