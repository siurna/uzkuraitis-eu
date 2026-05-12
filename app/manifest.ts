import type { MetadataRoute } from "next";

// PWA manifest. Generated at build time by Next so /manifest.webmanifest
// always reflects the current brand tokens.
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
        src: "/icon.png",
        sizes: "48x48",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "48x48",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["entertainment", "social"],
    orientation: "portrait",
  };
}
