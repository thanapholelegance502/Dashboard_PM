#!/usr/bin/env bash
# เช็กว่า Lark app (tenant_access_token) อ่าน tasklist ของบอร์ดแผนกได้ไหม — รันบน server ก่อนกด "กวาด Task" ครั้งแรก
# ใช้: bash scripts/check-lark-tasklist.sh ba.env
#   อ่าน LARK_APP_ID / LARK_APP_SECRET / TASKLIST_GUID จากไฟล์ env · ลองทั้ง open และ open-sg · ไม่พิมพ์ token/secret
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${1:-ba.env}"
[ -f "$ENV_FILE" ] || { echo "ไม่พบ $ENV_FILE"; exit 1; }
val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '\r"'"'"; }
APP_ID="$(val LARK_APP_ID)"; APP_SECRET="$(val LARK_APP_SECRET)"; GUID="$(val TASKLIST_GUID)"
[ -n "$APP_ID" ] && [ -n "$APP_SECRET" ] && [ -n "$GUID" ] || { echo "ต้องมี LARK_APP_ID / LARK_APP_SECRET / TASKLIST_GUID ใน $ENV_FILE"; exit 1; }

code_of() { sed -E 's/.*"code":([0-9]+).*/\1/'; }

for HOST in https://open.larksuite.com https://open-sg.larksuite.com; do
  echo "▶ $HOST"
  TOKEN_JSON="$(curl -sS -m 20 -X POST "$HOST/open-apis/auth/v3/tenant_access_token/internal" \
    -H 'Content-Type: application/json; charset=utf-8' \
    -d "{\"app_id\":\"$APP_ID\",\"app_secret\":\"$APP_SECRET\"}")" || { echo "  ✗ ต่อ host ไม่ได้"; continue; }
  TOKEN="$(printf '%s' "$TOKEN_JSON" | sed -nE 's/.*"tenant_access_token":"([^"]+)".*/\1/p')"
  if [ -z "$TOKEN" ]; then echo "  ✗ ขอ tenant_access_token ไม่ได้ (code $(printf '%s' "$TOKEN_JSON" | code_of)) — เช็ก App ID/Secret"; continue; fi
  echo "  ✓ tenant_access_token"
  RES="$(curl -sS -m 20 "$HOST/open-apis/task/v2/tasklists/$GUID" -H "Authorization: Bearer $TOKEN")"
  CODE="$(printf '%s' "$RES" | code_of)"
  NAME="$(printf '%s' "$RES" | sed -nE 's/.*"name":"([^"]*)".*/\1/p' | head -1)"
  case "$CODE" in
    0) echo "  ✓ อ่าน tasklist ได้: \"$NAME\" → ใช้ LARK_HOST=$HOST" ;;
    1470403|99991672|99991679) echo "  ✗ ไม่มีสิทธิ์ (code $CODE) — เพิ่ม app เป็นสมาชิก tasklist + เปิด scope task ของ app (ดู docs/BA-ONBOARDING.md)" ;;
    *) echo "  ✗ อ่าน tasklist ไม่ได้ (code ${CODE:-?})" ;;
  esac
done
