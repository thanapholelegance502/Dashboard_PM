#!/usr/bin/env bash
# สร้าง server/.env.production แบบ interactive — พิมพ์ค่าทีละอัน ไม่ต้อง paste/nano
# ใช้: bash setup-env.sh
set -e
cd "$(dirname "$0")"

echo "=== ตั้งค่า .env.production (dev-mode + http) ==="
read -rp "LARK_APP_SECRET: " SECRET
read -rp "Postgres password (ตั้งใหม่ได้): " DBPASS
SESSION=$(head -c 24 /dev/urandom | base64 2>/dev/null || echo "change-me-$(date +%s)")

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

echo ""
echo "✅ สร้าง server/.env.production แล้ว"
echo "ต่อไป:"
echo "  export POSTGRES_PASSWORD='${DBPASS}'"
echo "  bash deploy.sh"
