"use client";

import { useState } from "react";
import { fluentEmojiUrl } from "@/lib/fluent-emoji";

// Inline 3D emoji renderer. If the glyph is in our curated Fluent
// manifest the component renders the Microsoft Fluent 3D PNG;
// anything else (or a CDN load failure) falls back to the native
// emoji glyph inside a span so the surrounding layout stays
// identical either way.
//
// Used on the featured surfaces only — poll choices, top-3 medals,
// quick reactions, broadcast bonus chips. Chat message body emoji
// (user-typed) still uses the OS's emoji set.
export function FluentEmoji({
  glyph,
  size = 32,
  className = "",
  ariaLabel,
}: {
  glyph: string;
  /** Pixel size for the rendered image. Falls back to inline font
   *  size for the native fallback span. */
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Country flags fall through to the native emoji span below
  // (`fluentEmojiUrl` returns null since flags aren't in the
  // manifest). MS Fluent doesn't ship country flags by policy, and
  // shipping a third-party set (Twemoji etc) blew up the brand
  // language. OS-native flat flags are good enough — Apple/Android
  // render them cleanly; Windows users see letter pairs but they're
  // <2% of the audience.
  const url = fluentEmojiUrl(glyph);

  if (!url || failed) {
    return (
      <span
        className={`inline-block leading-none ${className}`}
        style={{ fontSize: size }}
        aria-label={ariaLabel}
        role={ariaLabel ? "img" : undefined}
      >
        {glyph}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={ariaLabel ?? ""}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      // `object-cover` + `shrink-0` defends against parents that
      // constrain only one axis (sonner toast icon slot, flex rows
      // with `items-stretch`) — without these the 1:1 PNG gets
      // resampled into the parent's non-square box and reads as
      // squished. minWidth/minHeight stops the box itself from
      // collapsing below the requested pixel size.
      className={`inline-block select-none shrink-0 object-cover ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
    />
  );
}
