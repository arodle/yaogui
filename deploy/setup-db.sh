#!/usr/bin/env bash
set -euo pipefail

DB_PASS="$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-28)"
printf '%s' "$DB_PASS" > "$HOME/.yaogui_db_password"
chmod 600 "$HOME/.yaogui_db_password"

sudo systemctl enable --now postgresql

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='yaogui'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER yaogui WITH PASSWORD '$DB_PASS'"
fi

sudo -u postgres psql -c "ALTER USER yaogui WITH PASSWORD '$DB_PASS'"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='yaogui'" | grep -q 1; then
  sudo -u postgres createdb -O yaogui yaogui
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE yaogui TO yaogui"
echo "database ready"
