#!/usr/bin/env bash
# Daily Postgres dump for the genealogie database.
# Runs as `achazeau` on the VPS (member of the docker group).
# Drops gzipped dumps into ~/genealogie-backups and rotates after 30 days.
#
# Usage: ./scripts/backup.sh
# Cron : 17 3 * * * /home/achazeau/genealogie/scripts/backup.sh >> /home/achazeau/genealogie-backups/cron.log 2>&1

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${HOME}/genealogie-backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/genealogie-${TIMESTAMP}.sql.gz"

cd "${PROJECT_DIR}"

# pg_dump from the running db container, gzipped to disk.
# -T disables TTY allocation so this works under cron.
docker compose exec -T db \
  pg_dump -U genealogie -d genealogie --clean --if-exists --no-owner \
  | gzip -9 > "${BACKUP_FILE}"

SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
LINES="$(gunzip -c "${BACKUP_FILE}" | wc -l)"

# Rotation
find "${BACKUP_DIR}" -name 'genealogie-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "$(date -u +%FT%TZ) OK ${BACKUP_FILE} (${SIZE}, ${LINES} lines, retention=${RETENTION_DAYS}d)"
