#!/usr/bin/env bash
# Deploy รอบเดียว — พิมพ์สั้นๆ ไม่ต้อง paste คำสั่งยาวใน console
# ใช้: bash deploy.sh
set -e
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"

# 1) ต้องมี env ก่อน
if [ ! -f server/.env.production ]; then
  echo "⚠️  ยังไม่มี server/.env.production"
  echo "    ทำครั้งเดียว:  cp server/.env.production.example server/.env.production"
  echo "    แล้วแก้ใส่ LARK_APP_SECRET / SESSION_SECRET / DATABASE_URL password"
  echo "    (แก้ในไฟล์:  nano server/.env.production )"
  exit 1
fi

: "${POSTGRES_PASSWORD:?ตั้งก่อน:  export POSTGRES_PASSWORD=<pass เดียวกับใน DATABASE_URL>}"

echo "▶ build + up (postgres + backend + web)…"
$COMPOSE up -d --build

echo "▶ รอ DB พร้อม…"; sleep 8

echo "▶ seed (section rules + projects เริ่มต้น)…"
$COMPOSE exec -T server npm run seed || echo "  (seed ซ้ำได้ ไม่เป็นไร)"

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "✅ ขึ้นแล้ว — เปิด  http://${IP:-<server-ip>}"
echo ""
echo "ขั้นต่อไป (authorize Lark ครั้งเดียว):"
echo "  $COMPOSE exec server npm run lark:authorize"
echo "  แล้ว:  $COMPOSE exec server npm run sync:once -- --snapshot"
