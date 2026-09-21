# Elegance PMO Dashboard

Dashboard บริหารโปรเจกต์หลายแผนก (PM · QA · BA · UX/UI) สำหรับผู้บริหาร (CEO/CFO) และ PM
ดึงข้อมูลจริงจาก **Lark Task API** → ETL → PostgreSQL → REST API → React dashboard

> แทนที่ prototype เดิมบน Genspark · ผู้สั่งงาน: ข้าว (PM, Elegance Consultant)
> **เอกสารสเปกกลางอยู่ที่ `00-MASTER.md` → `06-BUILD-PLAN.md`** (อ่านก่อนถ้าจะแก้ logic)

---

## สถานะปัจจุบัน (21 ก.ย. 2026)

| เฟส | สถานะ |
|---|---|
| P1 — Data Layer (Lark ETL) | ✅ เสร็จ · ดึง 6 บอร์ด ~772 การ์ด |
| P2 — PM Dashboard + Admin | ✅ เสร็จ (backend + frontend) |
| ส่วนเพิ่ม — Budget/งวดการเงิน · as-of · หน้า Finance (C-level) | ✅ เสร็จ |
| CRUD Section Rules (map เอง ไม่ต้องแก้ code) | ✅ เสร็จ |
| P0 — SSO auth · Deploy cloud | 🔜 กำลังทำ |
| เฟส QA / BA / UX-UI | ⬜ ยังไม่เริ่ม |

รายละเอียดสิ่งที่ทำ/จะทำ → **[docs/STATUS.md](docs/STATUS.md)**

---

## Stack

- **Backend**: Node.js 20 + Express + Prisma + PostgreSQL 16/17 (JavaScript, ESM)
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Recharts
- **Scheduler**: node-cron (08:00 / 17:00 Asia/Bangkok) ใน process เดียวกับ API
- **Auth**: dev-mode (auto ADMIN) ตอนนี้ · Lark SSO ตอน deploy

---

## Quick start (local)

**ต้องมี:** Node 20+, PostgreSQL (หรือ Docker), Lark app credentials

```bash
# 1) DB — ใช้ Postgres ที่มี หรือ docker compose up -d (postgres 16)
createdb pmo   # ถ้าใช้ Postgres local

# 2) Backend
cd server
cp .env.example .env         # ใส่ LARK_APP_SECRET + DATABASE_URL
npm install
npx prisma migrate deploy    # สร้างตาราง
npm run seed                 # section rules + projects เริ่มต้น
npm run lark:authorize       # ครั้งแรก: login Lark ในนามข้าว (ดู docs/DEV.md)
npm run sync:once            # ดึงข้อมูลจริงจาก Lark
node src/index.js            # API ที่ :3000

# 3) Frontend
cd ../web
npm install
npm run dev                  # ที่ :5173 (proxy /api → :3000)
```

เปิด `http://localhost:5173` — หน้า PM · `/finance` · `/admin`

> เปิดให้ LAN เข้า: Vite ตั้ง `host: true` แล้ว → `http://<เครื่อง-ip>:5173`
> ⚠️ ตอนนี้ dev-mode = **ทุกคนที่เข้าถึง = ADMIN** อย่าเปิดออก internet จนกว่าจะเปิด SSO

---

## Architecture

```
Lark Task API ──► ETL (extract/transform/load) ──► PostgreSQL ──► REST API ──► React
   (6 บอร์ด)      map section→dept/bucket/weight      (task/       /api/pm/*     PM / Finance / Admin
                  + snapshot รายวัน                    snapshot/    /api/admin/*
                                                       budget…)     /api/pm/finance
```

**หัวใจ:** 1 บอร์ด Lark มี section ของทุกแผนก → ETL ตัวเดียว เก็บตารางเดียว → dashboard แต่ละแผนก query ด้วย `dept_code` ต่างกัน (ไม่ต้องทำ pipeline แยกแผนก)

**สถานะงานมาจากชื่อ section** (ไม่ใช่ native done ของ Lark) → map เป็น rule ใน DB แก้ผ่านหน้า Admin ได้

---

## โครง repo

```
Dashboard/
├─ 00-MASTER.md … 06-BUILD-PLAN.md   # สเปกกลาง (อ่านก่อนแก้ logic)
├─ README.md · docs/                  # เอกสาร operational
├─ docker-compose.yml                 # postgres (dev)
├─ server/                            # backend
│  ├─ prisma/schema.prisma · seed.js
│  └─ src/{config,lark,etl,domain,api,jobs,db}/
└─ web/                               # frontend (React+TS)
   └─ src/{lib,components,pages}/
```

โครงละเอียด + หน้าที่แต่ละไฟล์ → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## เอกสาร

- **[docs/STATUS.md](docs/STATUS.md)** — ทำอะไรไปแล้ว · กำลังทำ · roadmap · blocked-on
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — โครงโค้ด, data model, API, สิ่งที่เรียนรู้จาก Lark
- **[docs/DEV.md](docs/DEV.md)** — setup ละเอียด, Lark authorize, test, กับดัก
- **[docs/MAINTAINING.md](docs/MAINTAINING.md)** — คู่มือดูแลระบบ (re-authorize, backup, เพิ่มบอร์ด, troubleshoot)
- **[docs/DEPLOY.md](docs/DEPLOY.md)** — แผน migrate ขึ้น cloud (linux) + SSO + docker

---

## Test

```bash
cd server && npm test    # 56 tests (domain + API integration)
```
