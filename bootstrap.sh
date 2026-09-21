#!/usr/bin/env bash
# Bootstrap fresh Ubuntu server → ทำงานครบในตัวเดียว
# ใช้ (ต้องมี git + clone repo มาก่อน):  sudo bash bootstrap.sh
set -e
cd "$(dirname "$0")"

echo "════ 1/4  ติดตั้ง Docker + git (ถ้ายังไม่มี) ════"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y docker.io git curl ca-certificates
  # docker compose plugin (v2) — ลอง apt ก่อน, ไม่มีก็ดึง binary
  apt-get install -y docker-compose-v2 2>/dev/null || apt-get install -y docker-compose-plugin 2>/dev/null || true
  systemctl enable --now docker
fi

if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi
echo "   docker: $(docker --version) · compose: $DC"

echo "════ 2/4  ตั้งค่า .env.production ════"
if [ ! -f server/.env.production ]; then
  read -rp "   LARK_APP_SECRET: " SECRET
  # password ต้องเป็น a-z A-Z 0-9 เท่านั้น (มี @ : / จะพัง DATABASE_URL)
  while true; do
    read -rp "   Postgres password (ตัวอักษร+ตัวเลขเท่านั้น ห้าม @:/ ): " DBPASS
    if [[ "$DBPASS" =~ ^[A-Za-z0-9]+$ ]]; then break; fi
    echo "   ✗ ใช้ได้แค่ a-z A-Z 0-9 (ที่ใส่มามีอักขระพิเศษ พังกับ URL) ลองใหม่"
  done
  SESSION=$(head -c24 /dev/urandom | base64 2>/dev/null || echo "change-$(date +%s)")
  cat > server/.env.production <<EOF
NODE_ENV=production
LARK_APP_ID=cli_aa20a1d6d338def1
LARK_APP_SECRET=${SECRET}
LARK_REDIRECT_URI=http://localhost:3000/api/auth/callback
DATABASE_URL=postgresql://postgres:${DBPASS}@postgres:5432/pmo
AUTH_MODE=dev
COOKIE_SECURE=false
TRUST_PROXY=true
SESSION_SECRET=${SESSION}
TZ=Asia/Bangkok
SYNC_CRON_MORNING=0 8 * * *
SYNC_CRON_EVENING=0 17 * * *
EOF
  export POSTGRES_PASSWORD="$DBPASS"
  echo "POSTGRES_PASSWORD=${DBPASS}" > .env   # compose อ่าน root .env อัตโนมัติ (ทุก session)
  echo "   ✓ สร้าง .env.production + .env"
else
  echo "   มี .env.production อยู่แล้ว"
  DBPASS=$(grep -oP 'postgres:\K[^@]+' server/.env.production | head -1)
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$DBPASS}"
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" > .env
fi

echo "════ 3/4  build + up (postgres + backend + web) ════"
$DC -f docker-compose.prod.yml up -d --build

echo "════ 4/4  seed ════"
echo "   รอ DB…"; sleep 10
$DC -f docker-compose.prod.yml exec -T server npm run seed || echo "   (seed ซ้ำได้ ไม่เป็นไร)"

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "══════════════════════════════════════════"
echo " ✅ เสร็จ — เปิด  http://${IP:-<server-ip>}"
echo ""
echo " authorize Lark (ครั้งเดียว):"
echo "   $DC -f docker-compose.prod.yml exec server npm run lark:authorize"
echo "   $DC -f docker-compose.prod.yml exec server npm run sync:once -- --snapshot"
echo "══════════════════════════════════════════"
