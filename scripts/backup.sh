#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${DB_PATH:-./data/copilot.db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y-%m-%d)
DEST="$BACKUP_DIR/copilot-$DATE.db"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: DB not found at $DB_PATH" >&2
  exit 1
fi

# SQLite .backup is safe for live databases (WAL mode)
sqlite3 "$DB_PATH" ".backup '$DEST'"
chmod 600 "$DEST"
echo "Backed up to $DEST"

# 30-day retention: delete backups older than 30 days
find "$BACKUP_DIR" -name "copilot-*.db" -mtime +30 -delete
