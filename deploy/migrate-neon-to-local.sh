#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$HOME/yaogui}"
NEON_URL_FILE="/tmp/yaogui-neon-url.txt"
LOCAL_DB="yaogui"
BACKUP_DIR="$HOME/yaogui-db-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
NEON_DUMP="/tmp/yaogui-neon-${STAMP}.dump"
LOCAL_BACKUP="${BACKUP_DIR}/yaogui-local-before-neon-${STAMP}.dump"
LOCAL_BACKUP_TMP="/tmp/yaogui-local-before-neon-${STAMP}.dump"
PG_DUMP="/usr/lib/postgresql/18/bin/pg_dump"
PG_RESTORE="/usr/lib/postgresql/18/bin/pg_restore"

if [[ ! -f "$NEON_URL_FILE" ]]; then
  echo "Missing ${NEON_URL_FILE}" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

NEON_URL="$(tr -d '\r\n' < "$NEON_URL_FILE")"
NEON_URL="${NEON_URL%\"}"
NEON_URL="${NEON_URL#\"}"
NEON_URL="${NEON_URL%\'}"
NEON_URL="${NEON_URL#\'}"

cleanup() {
  rm -f "$NEON_DUMP" "$NEON_URL_FILE"
}
trap cleanup EXIT

restart_api() {
  pm2 restart yaogui-api >/dev/null || pm2 start "$APP_DIR/server/dist/index.js" --name yaogui-api >/dev/null || true
}
trap restart_api ERR

 echo "Stopping API..."
pm2 stop yaogui-api >/dev/null || true

 echo "Backing up current local database..."
sudo -u postgres "$PG_DUMP" -Fc "$LOCAL_DB" -f "$LOCAL_BACKUP_TMP"
sudo mv "$LOCAL_BACKUP_TMP" "$LOCAL_BACKUP"
sudo chown "$USER:$USER" "$LOCAL_BACKUP"
chmod 600 "$LOCAL_BACKUP"

 echo "Dumping Neon database..."
"$PG_DUMP" --no-owner --no-acl --format=custom --file="$NEON_DUMP" "$NEON_URL"

 echo "Resetting local public schema..."
sudo -u postgres psql -d "$LOCAL_DB" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO yaogui;
GRANT ALL ON SCHEMA public TO public;
SQL

 echo "Restoring Neon dump into local database..."
sudo -u postgres "$PG_RESTORE" --no-owner --no-acl --dbname="$LOCAL_DB" "$NEON_DUMP"

 echo "Refreshing Prisma schema..."
cd "$APP_DIR"
npx prisma db push --schema prisma/schema.prisma

 echo "Restarting API..."
pm2 restart yaogui-api
pm2 save >/dev/null

 echo "Migration complete. Local backup: ${LOCAL_BACKUP}"
