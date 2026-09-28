#!/usr/bin/env bash
# MongoDB + upload хийсэн зургуудын backup. VPS дээр cron-оор өдөр бүр ажиллуулна:
#   crontab -e
#   15 3 * * * cd /home/<user>/nous && bash scripts/backup.sh >> backups/backup.log 2>&1
#
# Тохиргоо (env-ээр солиж болно):
#   BACKUP_DIR    — хадгалах хавтас (default: ./backups)
#   KEEP_DAYS     — хэдэн өдрийн backup хадгалах (default: 14)
#   COMPOSE_FILE  — docker compose файл (default: docker-compose.prod.yml)
#   RCLONE_REMOTE — (заавал биш) жнь "gdrive:nous-backups" — rclone-оор гадна хуулна
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
STAMP="$(date +%F_%H%M)"

mkdir -p "$BACKUP_DIR"
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

echo "==> [$STAMP] MongoDB dump..."
compose exec -T mongo mongodump --db nous --archive --gzip > "$BACKUP_DIR/mongo-$STAMP.gz"

echo "==> Uploads архив..."
compose exec -T server tar -czf - -C /app uploads > "$BACKUP_DIR/uploads-$STAMP.tgz" || \
  echo "   (uploads хоосон эсвэл Cloudinary ашиглаж байна — алгаслаа)"

# Хоосон/эвдэрсэн dump-ийг илрүүлэх
if [ ! -s "$BACKUP_DIR/mongo-$STAMP.gz" ]; then
  echo "!! MongoDB dump хоосон байна" >&2
  exit 1
fi

if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  echo "==> $RCLONE_REMOTE руу хуулж байна..."
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*-$STAMP.*"
fi

echo "==> $KEEP_DAYS өдрөөс хуучин backup устгаж байна..."
find "$BACKUP_DIR" -type f \( -name 'mongo-*.gz' -o -name 'uploads-*.tgz' \) -mtime +"$KEEP_DAYS" -delete

ls -lh "$BACKUP_DIR" | tail -n 5
echo "✓ Backup дууслаа"

# Сэргээх:
#   docker compose -f docker-compose.prod.yml exec -T mongo mongorestore --archive --gzip --drop < backups/mongo-XXXX.gz
