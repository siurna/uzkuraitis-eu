/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build-time safety nets re-enabled in v2.0. Fix the underlying error rather
  // than flipping these back on.
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Both Neon and Liveblocks ship with their own Edge-friendly drivers.
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
