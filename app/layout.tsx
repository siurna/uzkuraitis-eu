import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppToaster } from "@/components/app-toaster";
import { PageTransition } from "@/components/page-transition";
import { ViewportSync } from "@/components/viewport-sync";

// Icon bucket on Supabase Storage — the PNGs aren't checked in so the
// repo stays light. Browsers (and the install-prompt sheet) fetch
// these directly. If the bucket is down the browser falls back to the
// default favicon; an acceptable one-night-show trade.
const ICON_BUCKET =
  "https://mbgkujipbdfsdvjobtrf.supabase.co/storage/v1/object/public/icons";

export const metadata: Metadata = {
  title: {
    default: "Eurovision",
    template: "Eurovision",
  },
  description:
    "Cast your votes and watch live with friends. United by music, Vienna 2026.",
  applicationName: "Eurovision",
  appleWebApp: {
    capable: true,
    title: "Eurovision",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Eurovision",
    description:
      "Live voting and reactions for the 70th Eurovision Song Contest.",
    type: "website",
    images: [
      {
        url: `${ICON_BUCKET}/social-cover.webp`,
        width: 1200,
        height: 630,
        alt: "Eurovision 2026 - live voting + reactions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Eurovision",
    description:
      "Live voting and reactions for the 70th Eurovision Song Contest.",
    images: [`${ICON_BUCKET}/social-cover.webp`],
  },
  // Favicon + apple-touch-icon. We point straight at the Supabase
  // bucket instead of the Next metadata-file convention so the
  // binary PNGs don't live in git. Manifest icons (192/512/maskable)
  // are wired the same way in `app/manifest.ts`.
  icons: {
    icon: [
      { url: `${ICON_BUCKET}/favicon.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: `${ICON_BUCKET}/apple-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  // Tuned to sit inside the brand bloom (a deep violet that matches
  // the top of the html::before backdrop after fade-in). The earlier
  // #10142a was the manifest's flat splash colour, which left a hard
  // dark band behind the iOS status bar fighting the purple page.
  themeColor: "#1a1334",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Edge-to-edge so env(safe-area-inset-*) actually returns the notch /
  // home-indicator insets on iOS — the dock + header pad off them.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* Pre-warm the TLS handshake to Cloudflare so the Turnstile
            script + challenge endpoint don't pay DNS/TCP/TLS on cold
            start when the gate mounts. crossOrigin attribute keeps
            the preconnect usable for both the script fetch and the
            subsequent challenge XHRs. ~100-300ms shaved off the
            first-paint-to-token window in practice. */}
        <link rel="preconnect" href="https://challenges.cloudflare.com" crossOrigin="" />
      </head>
      {/* min-h-dvh, not 100vh: on iOS Safari `vh` is the *large* viewport
          (URL bar collapsed), so `min-h-screen` leaves a strip of phantom
          scroll whenever the URL bar is showing. dvh follows it. */}
      <body className="min-h-dvh antialiased">
        {/* Push window.innerHeight into --uzk-vh on resize so layouts
            can dodge iOS's flaky `dvh` unit. See components/viewport-sync.tsx. */}
        <ViewportSync />
        <PageTransition>{children}</PageTransition>
        <AppToaster />
      </body>
    </html>
  );
}
