import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy-init the Neon client + Drizzle wrapper. Throwing at module-load time
// would crash `next build`'s page-data collection pass on Vercel (it imports
// route handlers without runtime envs available). Only fail when a real
// query is made.
let cachedDb: NeonHttpDatabase<typeof schema> | null = null;
let cachedSql: NeonQueryFunction<false, false> | null = null;

function getConnection(): NeonHttpDatabase<typeof schema> {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon connection string to .env.local " +
        "or your Vercel project env vars (Production + Preview + Development).",
    );
  }

  cachedSql = neon(connectionString);
  cachedDb = drizzle(cachedSql, { schema });
  return cachedDb;
}

// Proxy keeps `db.select(...)` ergonomics but defers the env-var check until
// the first call site, not module evaluation. Importers don't need to change.
export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getConnection(), prop, receiver);
  },
});

export { schema };
