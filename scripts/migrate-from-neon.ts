/**
 * One-shot Neon → Supabase migration. Run locally:
 *
 *   pnpm tsx scripts/migrate-from-neon.ts
 *
 * Hardcoded source + target URLs (Neon read-only at this point, direct
 * Supabase URL for DDL + bulk writes). The Vercel hobby lambda can't
 * reach the IPv6-only direct host, so this has to run from a real
 * machine.
 *
 * Idempotent: schema runs ignore "already exists" errors, data inserts
 * use ON CONFLICT DO NOTHING on each table's PK.
 *
 * Flags:
 *   --schema-only   only run drizzle/*.sql against target
 *   --data-only     only copy table rows
 *   --dry-run       no writes; just print counts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const SOURCE =
  "postgresql://neondb_owner:npg_bPXRYzuQsU97@ep-noisy-cell-abz8i7cd-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const TARGET =
  "postgresql://postgres:k80OX1OQ819tCviC@db.mbgkujipbdfsdvjobtrf.supabase.co:5432/postgres";

const TABLES: { name: string; pk?: readonly string[] }[] = [
  { name: "rooms", pk: ["id"] },
  { name: "voters", pk: ["id"] },
  { name: "votes", pk: ["voter_id", "points"] },
  { name: "reactions", pk: ["room_id", "country_code", "emoji"] },
  { name: "room_settings", pk: ["room_id", "key"] },
  { name: "official_results", pk: ["country_code"] },
  { name: "commentator", pk: ["country_code"] },
  { name: "official_facts", pk: ["key"] },
  { name: "room_results", pk: ["room_id", "country_code"] },
  { name: "room_facts", pk: ["room_id", "key"] },
  { name: "chat_messages", pk: ["id"] },
  { name: "chat_reactions", pk: ["message_id", "session_id", "emoji"] },
  { name: "gif_cache", pk: ["q"] },
  { name: "chat_helper_cache", pk: ["kind", "text_key", "lang"] },
  { name: "push_subscriptions", pk: ["id"] },
  { name: "trivia_answers", pk: ["room_id", "session_id", "country_code"] },
  { name: "rate_limits", pk: ["bucket"] },
  { name: "admin_credentials", pk: ["id"] },
];

const CHUNK = 500;

const args = new Set(process.argv.slice(2));
const schemaOnly = args.has("--schema-only");
const dataOnly = args.has("--data-only");
const dryRun = args.has("--dry-run");

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
  const src = postgres(SOURCE, { prepare: false, max: 1, idle_timeout: 20 });
  const dst = postgres(TARGET, { prepare: false, max: 1, idle_timeout: 20 });

  try {
    if (!dataOnly) {
      const dir = join(process.cwd(), "drizzle");
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      console.log(`schema: ${files.length} migration files`);
      for (const f of files) {
        const stmts = splitStatements(readFileSync(join(dir, f), "utf8"));
        let errors = 0;
        let skipped = 0;
        if (!dryRun) {
          for (const stmt of stmts) {
            try {
              await dst.unsafe(stmt);
            } catch (err) {
              const msg = (err as Error).message;
              if (
                /already exists/i.test(msg) ||
                /duplicate (column|key|object|constraint)/i.test(msg)
              ) {
                skipped++;
                continue;
              }
              errors++;
              console.warn(`  ! ${f}: ${msg.split("\n")[0]}`);
            }
          }
        }
        console.log(
          `  ${f} (${stmts.length} stmts, ${skipped} skipped, ${errors} errors)`,
        );
      }
    }

    if (!schemaOnly) {
      console.log(`data: ${TABLES.length} tables`);
      for (const t of TABLES) {
        const rows = (await src.unsafe(
          `SELECT * FROM "${t.name}"`,
        )) as Record<string, unknown>[];

        let inserted = 0;
        if (rows.length > 0 && !dryRun) {
          const cols = Object.keys(rows[0]);
          const colsSql = cols.map((c) => `"${c}"`).join(", ");
          const conflict = t.pk
            ? `ON CONFLICT (${t.pk.map((c) => `"${c}"`).join(", ")}) DO NOTHING`
            : "";
          for (let i = 0; i < rows.length; i += CHUNK) {
            const chunk = rows.slice(i, i + CHUNK);
            const values = chunk.map((r) => cols.map((c) => r[c]));
            await dst.unsafe(
              `INSERT INTO "${t.name}" (${colsSql}) VALUES ${chunk
                .map(
                  (_, j) =>
                    `(${cols
                      .map((_, k) => `$${j * cols.length + k + 1}`)
                      .join(", ")})`,
                )
                .join(", ")} ${conflict}`,
              values.flat() as never[],
            );
            inserted += chunk.length;
          }
        }
        console.log(
          `  ${t.name.padEnd(22)} read=${rows.length}\tinserted=${inserted}`,
        );
      }
    }
    console.log("done.");
  } finally {
    await src.end({ timeout: 5 });
    await dst.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
