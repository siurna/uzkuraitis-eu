import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit doesn't introspect well through the pgbouncer pooler.
    // Prefer the direct/unpooled URL when available, fall back to the
    // pooled URL. Names match what Vercel's Supabase integration
    // auto-injects.
    url:
      process.env.SUPABASE_POSTGRES_URL_NON_POOLING ??
      process.env.SUPABASE_POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
