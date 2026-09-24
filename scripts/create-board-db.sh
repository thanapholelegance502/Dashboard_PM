#!/usr/bin/env bash
# สร้าง database + user แยกให้บอร์ดแผนก ใน Postgres ตัวเดียวกับ PMO (ดู docs/BOARD-INTEGRATION.md)
# ใช้: bash scripts/create-board-db.sh qa
#   → user qa_app (login ได้เฉพาะ database qa) + database qa (qa_app เป็นเจ้าของ สร้างตารางเองได้)
#   → user บอร์ดแผนกเข้า database pmo ไม่ได้
# รันซ้ำได้: ถ้ามีอยู่แล้วจะข้าม (ไม่ reset รหัส / ไม่ลบข้อมูล)
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-}"
if [[ ! "$NAME" =~ ^[a-z][a-z0-9_]{1,30}$ ]]; then
  echo "ใช้: bash scripts/create-board-db.sh <ชื่อบอร์ด>   (a-z 0-9 _ เช่น qa)"
  exit 1
fi
ROLE="${NAME}_app"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-pmo}"
PSQL="docker compose -f docker-compose.prod.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U $PG_USER -d $PG_DB"

if [ "$($PSQL -tAc "SELECT 1 FROM pg_roles WHERE rolname='$ROLE'")" = "1" ]; then
  echo "▶ มี user $ROLE อยู่แล้ว — ข้าม (ไม่เปลี่ยนรหัส)"
  PASS=""
else
  # a-z A-Z 0-9 เท่านั้น — กันอักขระพิเศษทำ DATABASE_URL พัง
  PASS="$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  $PSQL -c "CREATE ROLE $ROLE LOGIN PASSWORD '$PASS';"
  echo "▶ สร้าง user $ROLE แล้ว"
fi

if [ "$($PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='$NAME'")" = "1" ]; then
  echo "▶ มี database $NAME อยู่แล้ว — ข้าม"
else
  $PSQL -c "CREATE DATABASE $NAME OWNER $ROLE;"
  echo "▶ สร้าง database $NAME แล้ว"
fi

# user บอร์ดแผนกต่อได้เฉพาะ database ของตัวเอง (ไม่ใช่ pmo)
$PSQL -c "REVOKE CONNECT ON DATABASE $PG_DB FROM PUBLIC;"
$PSQL -c "REVOKE ALL ON DATABASE $NAME FROM PUBLIC;"

echo ""
if [ -n "$PASS" ]; then
  echo "✅ ใส่ใน ${NAME}.env (ห้ามขึ้น git — รหัสจะไม่แสดงอีก):"
  echo "   DATABASE_URL=postgresql://$ROLE:$PASS@postgres:5432/$NAME"
  echo "   DATABASE_SSL=false"
else
  echo "✅ database พร้อม (ใช้รหัสเดิมของ $ROLE)"
fi
