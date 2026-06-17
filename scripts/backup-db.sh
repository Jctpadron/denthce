#!/bin/bash
# Backup automático de PostgreSQL
# Uso: ./scripts/backup-db.sh [output-dir]
# Programar con cron: 0 3 * * * /path/to/scripts/backup-db.sh /backups

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-hce_admin}"
DB_NAME="${DB_NAME:-hce_fhir}"
DB_PASSWORD="${DB_PASSWORD:-}"

mkdir -p "$OUTPUT_DIR"

FILENAME="hce-backup-${TIMESTAMP}.sql.gz"
export PGPASSWORD="$DB_PASSWORD"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges \
  | gzip > "${OUTPUT_DIR}/${FILENAME}"

echo "Backup creado: ${OUTPUT_DIR}/${FILENAME} ($(du -h "${OUTPUT_DIR}/${FILENAME}" | cut -f1))"

# Rotación: mantener solo los últimos 30 backups
ls -tp "${OUTPUT_DIR}"/hce-backup-*.sql.gz 2>/dev/null | tail -n +31 | xargs -I {} rm -- {} 2>/dev/null || true
echo "Rotación completada: se conservan los últimos 30 backups."
