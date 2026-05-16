import type { MetadataRoute } from "next";

// PWA manifest. Generated at build time by Next so /manifest.webmanifest
// always reflects the current brand tokens.
//
// Icon assets live in Supabase Storage (the bucket below) so the PNG
// binaries don't bloat the repo. The favicon / apple-touch-icon are
// wired the same way in `app/layout.tsx` → `metadata.icons`.
const ICON_BUCKET =
  "https://mbgkujipbdfsdvjobtrf.supabase.co/storage/v1/object/public/icons";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eurovision",
    short_name: "Eurovision",
    description:
      "Cast your votes and watch live with friends. United by music, Vienna 2026.",
    start_url: "/",
    display: "standalone",
    // background_color paints the home-indicator strip + cold-start
    // splash; theme_color fills behind the status bar. Set to the
    // same near-black navy the html `background-color` carries, so
    // the iOS PWA chrome (status bar tint, home-indicator strip,
    // and crucially the strip iOS Safari paints behind a sliding
    // on-screen keyboard) all match the bottom of our gradient —
    // the chat surface then reads as continuous into the keyboard
    // instead of cutting against a brighter brand colour.
    background_color: "#0c1428",
    theme_color: "#0c1428",
    icons: [
      {
        src: `${ICON_BUCKET}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${ICON_BUCKET}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable = launcher can crop the outer ~10% (adaptive icon
      // shape varies per device). The source PNG must have its logo
      // centred + padded inward.
      {
        src: `${ICON_BUCKET}/icon-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["entertainment", "social"],
    orientation: "portrait",
  };
}
