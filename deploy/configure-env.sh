#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$HOME/yaogui}"
ENV_FILE="$APP_DIR/.env"
DB_PASS="$(cat "$HOME/.yaogui_db_password")"
DB_URL="postgresql://yaogui:${DB_PASS}@localhost:5432/yaogui?schema=public"

touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

set_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text().splitlines()
for i, line in enumerate(lines):
    if line.startswith(key + "="):
        lines[i] = f"{key}={value}"
        break
path.write_text("\n".join(lines) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env "DATABASE_URL" "$DB_URL"
set_env "PORT" "3001"
set_env "NODE_ENV" "production"

echo "env ready"
