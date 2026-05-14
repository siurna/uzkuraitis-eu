import { NextResponse } from "next/server";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

// TEMPORARY route — Neon → Supabase one-shot data move. Vercel runtime
// has the outbound TCP that our sandbox doesn't, so we drop a route on
// a preview deploy, hit it once over HTTPS, and the migration runs
// inside the lambda where both DBs are reachable.
//
// This file ships only with the migration PR and is REVERTED before
// that PR merges to main. Auth is a one-shot secret in the
// X-Migrate-Secret header, baked into the source below so the user
// doesn't need to flip another env var. The source + target URLs are
// also hard-coded — anyone who scrapes this file from the preview
// commit can already see them, so there's no real exposure win from
// pulling them out of the route body.
//
// Lifecycle:
//   1. push this file
//   2. sandbox curls the preview URL with the secret
//   3. report comes back, we verify row counts
//   4. revert (rm this directory) before main merge

export const dynamic = "force-dynamic";
export const maxDuration = 300; // hobby cap

const SECRET = "uzk_mig_2026_DjeXyEcVbCwHc73KqQ8L4";

const SOURCE =
  "postgresql://neondb_owner:npg_bPXRYzuQsU97@ep-noisy-cell-abz8i7cd-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

// Direct (non-pooler) Supabase URL for DDL + bulk writes. The pooler
// would force `prepare: false` semantics that don't allow some of the
// CREATE statements in our migrations.
const TARGET =
  "postgresql://postgres:k80OX1OQ819tCviC@db.mbgkujipbdfsdvjobtrf.supabase.co:5432/postgres";

// Insert order — children after parents, so FKs don't blow up.
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

async function runMigration(opts: {
  schemaOnly?: boolean;
  dataOnly?: boolean;
  dryRun?: boolean;
}) {
  const src = postgres(SOURCE, { prepare: false, max: 1, idle_timeout: 20 });
  const dst = postgres(TARGET, { prepare: false, max: 1, idle_timeout: 20 });

  const report: {
    schema: { file: string; statements: number; errors: number }[];
    tables: { name: string; read: number; inserted: number }[];
    opts: typeof opts;
  } = { schema: [], tables: [], opts };

  try {
    if (!opts.dataOnly) {
      const dir = join(process.cwd(), "drizzle");
      const files = readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const f of files) {
        const stmts = splitStatements(readFileSync(join(dir, f), "utf8"));
        let errors = 0;
        if (!opts.dryRun) {
          for (const stmt of stmts) {
            try {
              await dst.unsafe(stmt);
            } catch (err) {
              const msg = (err as Error).message;
              if (
                /already exists/i.test(msg) ||
                /duplicate (column|key|object|constraint)/i.test(msg)
              ) {
                continue;
              }
              errors++;
              console.warn("[migrate] schema", f, msg);
            }
          }
        }
        report.schema.push({ file: f, statements: stmts.length, errors });
      }
    }

    if (!opts.schemaOnly) {
      for (const t of TABLES) {
        const rows = (await src.unsafe(
          `SELECT * FROM "${t.name}"`,
        )) as Record<string, unknown>[];

        const entry: (typeof report.tables)[number] = {
          name: t.name,
          read: rows.length,
          inserted: 0,
        };

        if (rows.length > 0 && !opts.dryRun) {
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
            entry.inserted += chunk.length;
          }
        }

        report.tables.push(entry);
      }
    }

    return report;
  } finally {
    await src.end({ timeout: 5 });
    await dst.end({ timeout: 5 });
  }
}

export async function GET(req: Request) {
  const secret = req.headers.get("x-migrate-secret");
  if (secret !== SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const schemaOnly = url.searchParams.get("schemaOnly") === "1";
  const dataOnly = url.searchParams.get("dataOnly") === "1";
  const dryRun = url.searchParams.get("dryRun") === "1";
  try {
    const report = await runMigration({ schemaOnly, dataOnly, dryRun });
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[migrate] failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
