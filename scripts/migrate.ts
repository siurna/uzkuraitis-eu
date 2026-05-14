/**
 * One-shot migration runner. Reads every `drizzle/*.sql` file in order
 * and applies them against DATABASE_URL via postgres-js. Strips
 * leading comments and splits on `;` so each statement runs as its
 * own roundtrip. Idempotent if migration files use `IF NOT EXISTS`
 * (ours do).
 *
 * Run: pnpm tsx scripts/migrate.ts [from]
 *   from — optional starting migration number (e.g. "6" → skip 0–5).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1 });

const from = Number(process.argv[2] ?? 0);

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

function migrationNumber(file: string): number {
  const m = file.match(/^(\d+)/);
  return m ? Number(m[1]) : -1;
}

function splitStatements(body: string): string[] {
  const stripped = body
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
  return stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  for (const f of files) {
    const n = migrationNumber(f);
    if (n < from) {
      console.log(`skip ${f} (before ${from})`);
      continue;
    }
    const body = readFileSync(join(dir, f), "utf8");
    const stmts = splitStatements(body);
    console.log(`→ ${f} (${stmts.length} stmts)`);
    for (const stmt of stmts) {
      try {
        await sql.unsafe(stmt);
      } catch (err) {
        const msg = (err as Error).message;
        if (
          /already exists/i.test(msg) ||
          /duplicate (column|key|object)/i.test(msg)
        ) {
          console.warn(`  · already applied (${msg.split("\n")[0]})`);
        } else {
          console.error(`  ✗ ${msg}`);
          console.error(`     stmt: ${stmt.slice(0, 200)}`);
          process.exit(1);
        }
      }
    }
    console.log(`✓ ${f}`);
  }
  console.log("all migrations applied.");
  await sql.end();
}

main().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
