"use client";

import { useState } from "react";
import { fluentEmojiUrl, flagIsoFromGlyph } from "@/lib/fluent-emoji";
import { HeartFlag } from "@/components/flag";

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

  // Microsoft Fluent doesn't ship country flags, and the project's
  // flat-SVG `<Flag/>` looked out of place next to the rest of the
  // 3D emoji set (rectangle + flat colours vs glossy 3D blobs). The
  // brand's signature country chip is `<HeartFlag/>` — heart-shaped,
  // already used everywhere a country renders. Reusing it here makes
  // flag glyphs read as intentional brand callouts instead of OS
  // emoji fallbacks. (Hook above the conditional so order is stable.)
  const flagIso = flagIsoFromGlyph(glyph);
  if (flagIso) {
    return (
      <HeartFlag
        code={flagIso}
        size={size <= 16 ? "sm" : size <= 24 ? "md" : "lg"}
        className={className}
      />
    );
  }

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
