import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add a Neon connection string to .env.local " +
      "(e.g. postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require).",
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
export { schema };
