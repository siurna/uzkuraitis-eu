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
    // background_color is what iOS PWA paints under the home-indicator
    // area + the cold-start splash; theme_color is what fills behind
    // the status bar at the top. Both tuned to sit INSIDE the brand
    // bloom so the iOS chrome zones don't read as a black slab
    // against the purple page underneath.
    background_color: "#1a1334",
    theme_color: "#1a1334",
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
