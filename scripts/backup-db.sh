#!/usr/bin/env bash
# backup ทุก database ใน Postgres ของ stack (pmo + บอร์ดแผนก เช่น qa) — H-2 · ดู docs/MAINTAINING.md
# ใช้:  bash scripts/backup-db.sh
# cron: 15 2 * * * cd /root/Dashboard_PM && bash scripts/backup-db.sh >> /var/log/pmo-backup.log 2>&1
#
# ผลลัพธ์: $BACKUP_DIR/<YYYY-MM-DD_HHMM>/<db>.dump (pg_dump -Fc) + ลิงก์ $BACKUP_DIR/latest
# ลบชุดที่เก่ากว่า KEEP_DAYS วัน · dump ล้มตัวไหน = exit 1 (ไม่ลบชุดเก่า)
# ⚠️ backup อยู่ดิสก์เดียวกับ VM — VM หาย backup ก็หาย → เปิด auto-backup ของ provider หรือ copy ออกนอกเครื่องด้วย
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-/var/backups/pmo}"
KEEP_DAYS="${KEEP_DAYS:-14}"
PG_USER="${POSTGRES_USER:-postgres}"
# รันคำสั่ง postgres ที่ไหน — default = ใน container ของ stack (override ได้ตอน test)
PG_EXEC="${PG_EXEC:-docker compose -f docker-compose.prod.yml exec -T postgres}"

DBS="$($PG_EXEC psql -U "$PG_USER" -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres' ORDER BY datname")"
if [ -z "$DBS" ]; then
  echo "[backup] $(date -Is) ❌ ไม่พบ database ให้ backup"
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M)"
DEST="$BACKUP_DIR/$STAMP"
mkdir -p "$DEST"

FAILED=0
for db in $DBS; do
  if $PG_EXEC pg_dump -U "$PG_USER" -Fc "$db" > "$DEST/$db.dump" && [ -s "$DEST/$db.dump" ]; then
    echo "[backup] $(date -Is) ✅ $db → $DEST/$db.dump ($(du -h "$DEST/$db.dump" | cut -f1))"
  else
    echo "[backup] $(date -Is) ❌ $db dump ล้ม"
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "[backup] มี database ที่ dump ล้ม — ไม่ลบชุดเก่า"
  exit 1
fi

ln -sfn "$DEST" "$BACKUP_DIR/latest"

# ลบชุดเก่า (เฉพาะโฟลเดอร์ชื่อรูปแบบวันที่ที่สคริปต์นี้สร้าง)
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??_????' -mtime +"$KEEP_DAYS" -print -exec rm -rf {} + \
  | sed 's/^/[backup] ลบชุดเก่า: /'
echo "[backup] $(date -Is) เสร็จ — เก็บไว้ $KEEP_DAYS วันที่ $BACKUP_DIR"
