#!/usr/bin/env bash
# Freezely database backup — mirrors the LastWar approach: local pg_dump
# straight against the Supabase session pooler.
#
# Produces four files in backups/ (gitignored — the data contains customer
# emails and must never reach GitHub):
#   roles_<ts>.sql    cluster roles (pg_dumpall --globals-only)
#   schema_<ts>.sql   DDL for public/auth/storage
#   data_<ts>.sql     data for public/auth/storage as plain SQL
#   full_<ts>.dump    pg_dump custom-format archive of public (for pg_restore)
#
# Password: NOT taken from the command line. Create %APPDATA%/postgresql/pgpass.conf
# containing one line (no spaces):
#   aws-1-eu-west-1.pooler.supabase.com:5432:*:postgres.zuzfcnrejdtjehfocwos:<DB-PASSWORD>
# pg_dump picks it up automatically. chmod is not enforced on Windows.
#
# Usage:  bash scripts/backup-db.sh
set -euo pipefail

PGBIN="/c/tmp/pg17/pgsql/bin"           # Postgres 17 client tools (server is PG17;
                                         # the installed PG16 pg_dump refuses it)
HOST="aws-1-eu-west-1.pooler.supabase.com"
PORT=5432
USER="postgres.zuzfcnrejdtjehfocwos"
DB="postgres"
OUT="$(cd "$(dirname "$0")/.." && pwd)/backups"
TS="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT"

if [ ! -x "$PGBIN/pg_dump.exe" ]; then
  echo "ERROR: $PGBIN/pg_dump.exe not found — the portable PG17 tools have gone missing." >&2
  exit 1
fi

echo "== roles =="
"$PGBIN/pg_dumpall.exe" --globals-only --no-role-passwords \
  --no-publications --no-subscriptions --no-tablespaces \
  -h "$HOST" -p "$PORT" -U "$USER" -l "$DB" \
  -f "$OUT/roles_$TS.sql"

echo "== schema (public, auth, storage) =="
"$PGBIN/pg_dump.exe" --schema-only --quote-all-identifiers --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage \
  -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  -f "$OUT/schema_$TS.sql"

echo "== data (public, auth, storage) =="
"$PGBIN/pg_dump.exe" --data-only --quote-all-identifiers \
  --schema=public --schema=auth --schema=storage \
  -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  -f "$OUT/data_$TS.sql"

echo "== full custom-format archive (public) =="
"$PGBIN/pg_dump.exe" --format=custom --no-owner --no-privileges \
  --schema=public \
  -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
  -f "$OUT/full_$TS.dump"

echo
echo "Done:"
ls -lh "$OUT" | grep "$TS"
