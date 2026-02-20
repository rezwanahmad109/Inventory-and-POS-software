#!/bin/sh
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-inventory_pos}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-/migrations}"

export PGPASSWORD="$DB_PASSWORD"

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME"; do
  sleep 2
done

echo "Applying SQL migrations from ${MIGRATIONS_DIR}..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

for file in "${MIGRATIONS_DIR}"/*_up.sql; do
  if [ ! -f "$file" ]; then
    continue
  fi

  filename="$(basename "$file")"
  already_applied="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '${filename}' LIMIT 1")"
  if [ "$already_applied" = "1" ]; then
    echo "Skipping ${filename} (already applied)"
    continue
  fi

  echo "Running ${filename}"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$file"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations(filename) VALUES ('${filename}')"
done

echo "SQL migrations completed successfully."
