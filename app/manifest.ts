import type { MetadataRoute } from "next";

// PWA manifest. Generated at build time by Next so /manifest.webmanifest
// always reflects the current brand tokens.
//
// Icons live in two places: the Next metadata-file convention picks up
// `app/icon.png` (favicon source) + `app/apple-icon.png` (iOS Add-to-
// Home tile) automatically. The manifest below adds the 192/512 +
// maskable variants that Chrome/Android use for the install prompt and
// the adaptive launcher icon. See public/icons/README.md.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Eurovision",
    short_name: "Eurovision",
    description:
      "Cast your votes and watch live with friends. United by music, Vienna 2026.",
    start_url: "/",
    display: "standalone",
    background_color: "#10142a",
    theme_color: "#10142a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable = launcher can crop the outer ~10% (adaptive icon
      // shape varies per device). The source PNG must have its logo
      // centred + padded inward.
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["entertainment", "social"],
    orientation: "portrait",
  };
}
