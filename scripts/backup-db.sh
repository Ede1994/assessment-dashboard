#!/bin/bash
# Assessment-DB Backup (Hermes 2026-10-12): konsistente Online-Kopie via sqlite3 .backup
set -euo pipefail
DB=/opt/assessment-dashboard/data/dev.db
DEST=/opt/assessment-dashboard/data/backups
STAMP=$(date +%Y%m%d-%H%M)
sqlite3 "$DB" ".backup '$DEST/dev-$STAMP.db'"
tar czf "$DEST/uploads-$STAMP.tar.gz" -C /opt/assessment-dashboard/data uploads
ls -1t "$DEST"/dev-*.db | tail -n +8 | xargs -r rm -f
ls -1t "$DEST"/uploads-*.tar.gz | tail -n +8 | xargs -r rm -f
echo "backup ok: $STAMP"
