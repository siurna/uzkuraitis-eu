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

  // Microsoft Fluent doesn't ship country flags. Earlier this
  // component intercepted regional-indicator pairs and rendered them
  // via HeartFlag, but inside emoji marquees + bingo cells the
  // heart-chip read as a different shape language and looked out of
  // place. Flag glyphs now fall through to the native emoji span
  // below — the OS-rendered flat flag sits closer to the Fluent
  // set's footprint than the branded chip does in those contexts.
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
      className={`inline-block select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
