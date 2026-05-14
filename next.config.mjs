/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build-time safety nets re-enabled in v2.0. Fix the underlying error rather
  // than flipping these back on.
  reactStrictMode: true,
  typedRoutes: true,
  // postgres-js needs to live outside the bundled Next runtime so its
  // TCP socket internals aren't browser-shimmed during build.
  serverExternalPackages: ["postgres"],
  // Allow-list the hosts the Next image optimizer is allowed to fetch
  // from when callers pass `/_next/image?url=https://…`. Past-act
  // avatars + chat uploads live in Supabase Storage (the `avatars` and
  // `chat` public buckets); the Vercel Blob entries are kept for any
  // older URLs lingering in production data. `localPatterns` stays
  // wide-open so /participants/* and the rest of public/ still
  // optimise.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
    ],
    localPatterns: [{ pathname: "/**" }],
    // Next 16 rejects widths that aren't in the configured size lists
    // (no more silent round-up — `w=320` returns 400 unless it's listed
    // here). Profile sheet uses 320; the rest of the app sticks to the
    // built-in defaults.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 320, 384],
    qualities: [50, 70, 72, 75, 90, 100],
  },
  // Next 15 defaults the dynamic-segment client router-cache TTL to 0s,
  // so every tab navigation re-fetches the room layout + page from the
  // server — which reads like a full reload. Cache them briefly so
  // switching tabs within a room is instant. Live state still updates
  // via the Liveblocks broadcasts + the refetch in RoomShell.
  experimental: {
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
