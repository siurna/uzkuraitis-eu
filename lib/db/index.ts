import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Postgres client over postgres-js. Talks to Supabase through the
// pgbouncer transaction-mode pooler (port 6543). Transaction-mode
// pooling can't keep server-side prepared statements alive across
// connections, so `prepare: false` is non-negotiable.
//
// Connection URL comes from SUPABASE_POSTGRES_URL — what Vercel's
// Supabase integration auto-injects. We accept DATABASE_URL as a
// fallback so this still works in environments (other hosts, local
// dev) where the integration isn't wired.
//
// Lazy init: env vars aren't readable during the `next build`
// page-data collection pass on Vercel. Throwing at module load would
// brick deploys, so we resolve on first query instead.

type Sql = ReturnType<typeof postgres>;

let cachedDb: PostgresJsDatabase<typeof schema> | null = null;
let cachedSql: Sql | null = null;

function getConnection(): PostgresJsDatabase<typeof schema> {
  if (cachedDb) return cachedDb;

  const connectionString =
    process.env.SUPABASE_POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "SUPABASE_POSTGRES_URL is not set. Connect the Supabase " +
        "integration in Vercel (which injects it automatically) or set " +
        "it manually in .env.local for Production + Preview + Development.",
    );
  }

  cachedSql = postgres(connectionString, {
    // pgbouncer transaction-mode pooler (Supabase port 6543) needs
    // this — prepared statements can't survive across pooled
    // connections.
    prepare: false,
    // Per-Lambda socket cap. The 2026-05-16 live show surfaced that
    // `max:2` (the previous "respect pgbouncer's 200-client ceiling"
    // tune) was too aggressive in the other direction: every endpoint
    // started hanging at HTTP 000 (15s timeouts) within ~30s of
    // opening voting. Handlers doing Promise.all fan-outs (profile
    // drawer, leaderboard, /admin/live) were serialising onto 2
    // sockets and queuing forever behind concurrent room heartbeats.
    // Restoring max:8 + idle:20s — pgbouncer is happy up to ~200
    // backends and a typical 30-50 Lambda climax sits well under
    // that. If EMAXCONN starts firing again, lift it on the
    // pgbouncer side (Supabase dashboard → Database → Pool config)
    // rather than choking each Lambda.
    max: 8,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  cachedDb = drizzle(cachedSql, { schema });
  return cachedDb;
}

// Proxy keeps `db.select(...)` ergonomics but defers the env-var check
// until the first call site, not module evaluation. Importers don't
// need to change.
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getConnection(), prop, receiver);
  },
});

export { schema };
