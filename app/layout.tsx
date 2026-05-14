import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppToaster } from "@/components/app-toaster";
import { PageTransition } from "@/components/page-transition";

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
  themeColor: "#10142a",
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
      {/* min-h-dvh, not 100vh: on iOS Safari `vh` is the *large* viewport
          (URL bar collapsed), so `min-h-screen` leaves a strip of phantom
          scroll whenever the URL bar is showing. dvh follows it. */}
      <body className="min-h-dvh antialiased">
        <PageTransition>{children}</PageTransition>
        <AppToaster />
      </body>
    </html>
  );
}
