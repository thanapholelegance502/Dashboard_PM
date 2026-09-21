# DEV — setup ละเอียด, Lark authorize, test

---

## Prerequisites
- Node.js 20+
- PostgreSQL 16/17 (local brew หรือ `docker compose up -d`)
- Lark app credentials (App ID + Secret) — ใส่ใน `server/.env`

## DB setup

**ใช้ Postgres local (brew):**
```bash
createdb pmo
# DATABASE_URL=postgresql://<user>@localhost:5432/pmo
```
**หรือ Docker:**
```bash
docker compose up -d    # postgres 16, user/pass postgres, db pmo
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pmo
```

```bash
cd server
npx prisma migrate deploy   # สร้างตาราง
npm run seed                # section rules + 3 project เริ่มต้น + dev admin
```

## Lark authorize (ครั้งแรก / กู้คืน token)

```bash
cd server && npm run lark:authorize
```
1. script print URL (host `accounts.larksuite.com`) — เปิดใน browser
2. **ข้าว** login + กดอนุญาต (ต้องเป็นสมาชิก tasklist ที่จะดึง)
3. callback → เขียน token ลง DB (`OAuthToken`)

Token refresh อัตโนมัติเมื่อใกล้หมด (5 นาทีก่อน) · ถ้า refresh พัง → banner "re-authorize"

## Sync

```bash
npm run sync:once              # ดึง Lark 1 รอบ
npm run sync:once -- --snapshot  # + เขียน snapshot วันนี้
```
หรือ cron 08:00/17:00 อัตโนมัติเมื่อ `node src/index.js` รันอยู่

## Run

```bash
# terminal 1
cd server && node src/index.js      # API :3000
# terminal 2
cd web && npm run dev               # :5173 (proxy /api → :3000)
```

## Test

```bash
cd server && npm test    # vitest — domain (bucket/progress/status/attention/metrics) + API integration
```

## เพิ่มบอร์ดใหม่ (self-service)
1. หน้า Admin → โปรเจกต์ → **+ เพิ่มโปรเจกต์** → วาง Lark tasklist_guid
2. กด Sync now → ข้อมูลเข้า
3. หน้า Admin → **Section Rules** → banner จะเตือน section ที่ยังไม่ map → กด "map" → เลือก dept/bucket/weight → บันทึก (recompute ทันที ไม่ต้องยิง Lark ใหม่)

## กับดักที่เจอบ่อย
- **502 ตอน authorize/token** = ใช้ host ผิด (ดู [ARCHITECTURE.md](ARCHITECTURE.md) 3-host)
- **404 ตอนดึง section** = ใช้ path `/tasklists/{guid}/sections` (ต้องเป็น `/task/v2/sections?...`)
- **progress เพี้ยน/ต่ำ** = section ใหม่ยังไม่ map (deptCode=NONE) → ดู banner Admin
- **การ์ดไม่ครบ** = pagination หยุดก่อน (ต้องวนจน has_more=false)
- **`.env` ห้ามขึ้น git** — มี LARK_APP_SECRET
