#!/usr/bin/env bash
# Deploy รอบเดียว (manual) — ดึง image ล่าสุดจาก GHCR แล้ว up
# ปกติ "ไม่ต้องรันเอง" เพราะ watchtower ดึงให้อัตโนมัติหลัง merge main
# ใช้เมื่ออยาก deploy ทันที / รอบแรก / หลังแก้ env
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

# 2) ต้อง login GHCR ก่อน (image เป็น private) — ครั้งเดียวก็พอ (ดู docs/CICD.md)
if ! grep -q "ghcr.io" "${DOCKER_CONFIG:-$HOME/.docker}/config.json" 2>/dev/null; then
  echo "⚠️  ยังไม่ได้ login ghcr.io — image เป็น private ดึงไม่ได้"
  echo "    ทำครั้งเดียว:  echo <GHCR_PAT> | docker login ghcr.io -u <github-user> --password-stdin"
  echo "    (PAT ต้องมีสิทธิ์ read:packages — ดู docs/CICD.md)"
  exit 1
fi

echo "▶ pull image ล่าสุด + up (postgres + backend + web + watchtower)…"
$COMPOSE pull
$COMPOSE up -d

echo "▶ รอ DB + migrate…"; sleep 8

echo "▶ seed (section rules + projects เริ่มต้น)…"
$COMPOSE exec -T server npm run seed || echo "  (seed ซ้ำได้ ไม่เป็นไร)"

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "✅ ขึ้นแล้ว — เปิด  http://${IP:-<server-ip>}"
echo "   จากนี้ merge main = watchtower deploy ให้เอง (ไม่ต้องรัน deploy.sh อีก)"
echo ""
echo "ขั้นต่อไป (authorize Lark ครั้งเดียว):"
echo "  $COMPOSE exec server npm run lark:authorize"
echo "  แล้ว:  $COMPOSE exec server npm run sync:once -- --snapshot"
