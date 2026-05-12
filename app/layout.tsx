import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Toaster } from "sonner";
import { PageTransition } from "@/components/page-transition";

export const metadata: Metadata = {
  title: {
    default: "Eurovision 2026",
    template: "Eurovision 2026",
  },
  description:
    "Cast your votes and watch live with friends. United by music, Vienna 2026.",
  applicationName: "Eurovision 2026",
  openGraph: {
    title: "Eurovision 2026",
    description:
      "Live voting and reactions for the 70th Eurovision Song Contest.",
    type: "website",
  },
  // Favicon is auto-bound by app/icon.svg (Next metadata file convention).
};

export const viewport: Viewport = {
  themeColor: "#10142a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <PageTransition>{children}</PageTransition>
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "oklch(20% 0.07 264 / 0.9)",
              border: "1px solid oklch(50% 0.2 336 / 0.4)",
              color: "white",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
