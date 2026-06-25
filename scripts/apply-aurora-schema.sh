#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required."
  echo "Example: export DATABASE_URL='postgres://user:password@host:5432/graphflow?sslmode=require'"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply the Aurora schema."
  echo "Install PostgreSQL client tools, then rerun this script."
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/database/aurora-schema.sql"
echo "Aurora schema applied."
