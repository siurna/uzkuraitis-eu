import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Postgres client over postgres-js. Talks to Supabase through the
// pgbouncer transaction-mode pooler (port 6543). Transaction-mode
// pooling can't keep server-side prepared statements alive across
// connections, so `prepare: false` is non-negotiable.
//
// Lazy init: process.env.DATABASE_URL isn't readable during the
// `next build` page-data collection pass on Vercel. Throwing at module
// load would brick deploys. We resolve on first query instead.

type Sql = ReturnType<typeof postgres>;

let cachedDb: PostgresJsDatabase<typeof schema> | null = null;
let cachedSql: Sql | null = null;

function getConnection(): PostgresJsDatabase<typeof schema> {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add the Supabase pooled connection string " +
        "to .env.local or your Vercel project env vars (Production + " +
        "Preview + Development).",
    );
  }

  cachedSql = postgres(connectionString, {
    // pgbouncer transaction-mode pooler (Supabase port 6543) needs
    // this — prepared statements can't survive across pooled
    // connections.
    prepare: false,
    // Lazy-open up to 8 sockets per Lambda so Promise.all fan-outs
    // (e.g. the profile drawer's 9 parallel queries) actually run in
    // parallel instead of queuing on one connection. postgres-js only
    // opens sockets when concurrent queries demand them, so the
    // sequential-query case still costs 1 socket. pgbouncer multiplexes
    // these onto the underlying Postgres pool.
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
