// Stamp public/sw.js with a fresh CACHE version on every build, so a
// production deploy is guaranteed to invalidate every PWA's cached
// JS bundle. Vercel's build container is ephemeral — the in-place
// edit below ships in the deployment artifact and never re-enters
// git. The marker we replace is the literal source line
//
//     const CACHE = "esc-2026-...";
//
// Resolution order for the version slug:
//   1. VERCEL_GIT_COMMIT_SHA          (Vercel build)
//   2. GITHUB_SHA                     (GitHub Actions)
//   3. `git rev-parse --short=7 HEAD` (local build)
//   4. timestamp                      (no git available)
//
// Run automatically as `prebuild` (see package.json). For local dev
// (`pnpm dev`) the SW is served as-is from disk; this script is a
// build-time concern only.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const SW_PATH = resolve("public/sw.js");

function shortSha() {
  const envSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (envSha) return envSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { encoding: "utf8" }).trim();
  } catch {
    return `t${Date.now().toString(36)}`;
  }
}

const sha = shortSha();
const src = readFileSync(SW_PATH, "utf8");
const stamped = src.replace(
  /const CACHE = "esc-2026-[a-zA-Z0-9_-]+";/,
  `const CACHE = "esc-2026-${sha}";`,
);
if (stamped === src) {
  console.error(
    "[stamp-sw] CACHE marker not found in public/sw.js — did the format change?",
  );
  process.exit(1);
}
writeFileSync(SW_PATH, stamped);
console.log(`[stamp-sw] CACHE → esc-2026-${sha}`);
