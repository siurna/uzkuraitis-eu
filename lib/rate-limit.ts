import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

// Durable token-bucket rate limiter. One INSERT … ON CONFLICT roundtrip
// per call; counter resets when the window expires. Designed to replace
// the in-memory `floodCheck` Map that was only as durable as a single
// warm serverless instance.
//
// Usage:
//   const rl = await checkAndIncrement(`chat:${room.id}:${session}`, 12, 10_000);
//   if (!rl.ok) return NextResponse.json({ error: "Slow down" }, { status: 429 });

export async function checkAndIncrement(
  bucket: string,
  max: number,
  windowMs: number,
): Promise<{ ok: boolean; hits: number }> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);

  // Postgres can't directly compare a passed-in JS Date with a column
  // expression inside a CASE, but we can interpolate ISO strings and
  // let it cast. Doing both branches of the CASE in the same statement
  // gives us a single atomic upsert with no read-then-write race.
  const result = await db.execute<{ hits: number }>(sql`
    INSERT INTO rate_limits (bucket, hits, window_start)
    VALUES (${bucket}, 1, ${now.toISOString()})
    ON CONFLICT (bucket) DO UPDATE
      SET hits = CASE
        WHEN rate_limits.window_start < ${cutoff.toISOString()}::timestamptz THEN 1
        ELSE rate_limits.hits + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start < ${cutoff.toISOString()}::timestamptz THEN ${now.toISOString()}::timestamptz
        ELSE rate_limits.window_start
      END
    RETURNING hits;
  `);
  const hits = result.rows[0]?.hits ?? 0;
  return { ok: hits <= max, hits };
}
