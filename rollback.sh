#!/usr/bin/env bash
# Rollback — ดึง production กลับไปเวอร์ชันเก่า "ทันที" โดยไม่ต้อง rebuild
# ทุก commit ที่ merge main จะมี image tag = sha-<commit สั้น> เก็บไว้ใน GHCR
# ใช้: bash rollback.sh <sha-xxxxxxx | latest>
#   ตัวอย่าง:  bash rollback.sh sha-a1b2c3d      # ย้อนไป commit นั้น
#             bash rollback.sh latest            # กลับมา auto (เวอร์ชันล่าสุด)
set -e
cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.prod.yml"
TAG="${1:-}"

if [ -z "$TAG" ]; then
  echo "ใช้:  bash rollback.sh <image-tag>"
  echo ""
  echo "tag ที่มี (จาก git log — เอา 7 ตัวแรกมาเติมหน้า sha-):"
  git log --oneline -15 --format='  sha-%h  %s' 2>/dev/null || true
  echo ""
  echo "หรือ  bash rollback.sh latest   (กลับมาเวอร์ชันล่าสุด + auto-deploy)"
  exit 1
fi

: "${POSTGRES_PASSWORD:?ตั้งก่อน:  export POSTGRES_PASSWORD=<pass เดียวกับใน DATABASE_URL>}"

echo "▶ pin เป็น image tag: ${TAG}"
# เขียน IMAGE_TAG ลง root .env (compose อ่านอัตโนมัติ) — คงค่าไว้ข้าม restart
if grep -q '^IMAGE_TAG=' .env 2>/dev/null; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${TAG}/" .env
else
  echo "IMAGE_TAG=${TAG}" >> .env
fi

echo "▶ pull + up (rollback)…"
IMAGE_TAG="$TAG" $COMPOSE pull server web
IMAGE_TAG="$TAG" $COMPOSE up -d server web

echo ""
if [ "$TAG" = "latest" ]; then
  echo "✅ กลับมา latest — watchtower จะ auto-deploy ต่อจากนี้ตามปกติ"
else
  echo "✅ rollback ไป ${TAG} แล้ว"
  echo "   ⚠️ ตอนนี้ pin อยู่ที่ ${TAG} — watchtower จะไม่ auto-update (sha tag ไม่เปลี่ยน)"
  echo "   กลับมา auto เมื่อพร้อม:  bash rollback.sh latest"
  echo ""
  echo "   💡 ถ้าจะแก้ถาวร: git revert <commit เสีย> → PR → merge main (pipeline ปกติ)"
fi