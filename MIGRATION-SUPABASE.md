# Neon → Supabase cutover

The app code already speaks postgres-js (works against both Neon TCP
and Supabase). Two steps to finish the move: copy the data, flip
`DATABASE_URL` in Vercel.

## 1. Dump Neon and restore to Supabase

Run this from any machine with `pg_dump` + `psql` installed (16+):

```bash
NEON_URL='postgresql://neondb_owner:npg_bPXRYzuQsU97@ep-noisy-cell-abz8i7cd-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# Supabase direct connection (not the pooler) for dump-and-restore.
SUPABASE_DIRECT_URL='postgresql://postgres:k80OX1OQ819tCviC@db.mbgkujipbdfsdvjobtrf.supabase.co:5432/postgres'

# 1a. Dump Neon (schema + data) to a file. ~5 seconds for our size.
pg_dump "$NEON_URL" \
  --no-owner --no-privileges --no-publications --no-subscriptions \
  --no-comments --schema=public --format=plain \
  --file=neon-dump.sql

# 1b. Restore into Supabase. The output is noisy — that's normal.
psql "$SUPABASE_DIRECT_URL" --single-transaction -f neon-dump.sql
```

If `psql` complains about extensions, run this once on Supabase first
(via the SQL editor in the dashboard, or psql):

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Verify row counts match:

```bash
for db in "$NEON_URL" "$SUPABASE_DIRECT_URL"; do
  echo "=== $(echo "$db" | cut -d@ -f2 | cut -d/ -f1) ==="
  psql "$db" -c "
    SELECT relname AS table, n_live_tup AS rows
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname;
  "
done
```

## 2. Flip the Vercel env

In the Vercel dashboard for the `uzkuraitis-eu` project, set
**Production + Preview + Development**:

```
DATABASE_URL  =  postgresql://postgres.mbgkujipbdfsdvjobtrf:k80OX1OQ819tCviC@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x
```

This is the **transaction-mode pooler** (port 6543) — what every
serverless invocation should use. The direct URL above is only for
dumps/migrations.

`CRON_SECRET` will be set automatically by Vercel the first time the
new `vercel.json` is deployed; no manual step.

Redeploy production. Hit the app, verify rooms load + chat works.

## 3. (Once happy) Decommission Neon

After 48-72 hours of clean Supabase traffic and no rollback events,
remove the Neon project from the Vercel integration. The `db` client
in `lib/db/index.ts` is provider-agnostic, so a future swap is just an
env-var flip.

## Notes

- `postgres-js` runs over TCP and goes through Supabase's pgbouncer at
  6543. `prepare: false` in `lib/db/index.ts` is required for
  transaction-mode pooling.
- `vercel.json` schedules a daily `/api/cron/keep-alive` ping. Supabase
  pauses free-tier projects after 7 days of zero query traffic — this
  ping keeps the project warm without us paying for an upgrade.
- The keep-alive route checks `Authorization: Bearer ${CRON_SECRET}`,
  which Vercel injects on cron-triggered requests automatically.
