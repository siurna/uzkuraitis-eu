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
    // Per-Lambda socket cap. With Vercel running 50+ concurrent
    // Lambdas during a busy watch party, max:8 blew past pgbouncer's
    // 200-client ceiling and the room lookup started erroring with
    // EMAXCONN. Drop to 2 so the same 200-client budget supports
    // ~100 concurrent Lambdas — well above the climax fan-out — at
    // the cost of serialising the rare 9-parallel-query handler.
    max: 2,
    // Release idle sockets fast so a quiet Lambda gives its slot
    // back to the pool. Was 20s; cuts dead-weight by ~4×.
    idle_timeout: 5,
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
