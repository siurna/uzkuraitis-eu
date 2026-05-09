import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Užkuraitis · Eurovision 2026 Vienna",
  description:
    "Cast your votes and watch live with friends. United by music — Vienna 2026.",
  applicationName: "Užkuraitis 2026",
  openGraph: {
    title: "Užkuraitis · Eurovision 2026 Vienna",
    description:
      "Live voting & reactions for the 70th Eurovision Song Contest.",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
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
        {children}
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
