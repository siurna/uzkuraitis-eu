/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build-time safety nets re-enabled in v2.0. Fix the underlying error rather
  // than flipping these back on.
  reactStrictMode: true,
  typedRoutes: true,
  // Both Neon and Liveblocks ship with their own Edge-friendly drivers.
  serverExternalPackages: ["@neondatabase/serverless"],
  // Let the image optimizer fetch avatar photos mirrored to the Vercel
  // Blob store by `pnpm avatars:upload` — otherwise `/_next/image?url=
  // https://…blob.vercel-storage.com/…` is rejected. Single `*` for the
  // store subdomain (Vercel's own recommendation). `localPatterns` kept
  // wide-open so /participants/* etc. still optimise.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com", pathname: "/**" },
    ],
    localPatterns: [{ pathname: "/**" }],
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
