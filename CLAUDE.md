# CLAUDE.md — context สำหรับ AI (อ่านไฟล์นี้ก่อนเริ่มงาน)

> Elegance PMO Dashboard · session ใหม่: ดึง git แล้วอ่านไฟล์นี้ + `docs/STATUS.md` ก่อนลงมือ

## โปรเจกต์นี้คืออะไร
Dashboard บริหารโปรเจกต์หลายแผนก (PM · QA · BA · UX/UI) สำหรับ CEO/CFO + PM
ดึงข้อมูลจริงจาก **Lark Task API** → ETL → PostgreSQL → REST API → React dashboard
แทน prototype เดิมบน Genspark · ผู้สั่งงาน: ข้าว (PM, Elegance Consultant)

## สถานะปัจจุบัน (24 ก.ย. 2026) — ละเอียดดู [docs/STATUS.md](docs/STATUS.md)
- ✅ **P1 Data Layer** — Lark ETL · OAuth + refresh rotation · snapshot · cron
- ✅ **PM Dashboard + Admin + Finance** — KPI/Gantt/drill-down · section rules · budget/งวดการเงิน · as-of
- ✅ **POC ขึ้นจริง** `https://elegancedb.duckdns.org` — Vultr + DuckDNS + Caddy (HTTPS) → [docs/POC-DEPLOY.md](docs/POC-DEPLOY.md)
- ✅ **Lark SSO + whitelist** (`AUTH_MODE=lark_sso`) · Admin แท็บ "ผู้ใช้" · หน้า 🚫 คนนอก whitelist
- ✅ **Portal หลายแผนก** — landing เลือกบอร์ด · สิทธิ์บอร์ดรายคน · บอร์ด QA ที่ `/qa/` (repo Dashboard_Tester) → [docs/BOARD-INTEGRATION.md](docs/BOARD-INTEGRATION.md)
- ✅ **CI/CD ทำงานแล้ว** — merge main → test + build image → GHCR → watchtower บน Vultr deploy เอง (~2–5 นาที)
- ✅ **Hardening** — session ใน Postgres (H-1) · backup cron ทุกวัน (H-2) · ufw 22/80/443 · เชื่อม Lark ใหม่ผ่านปุ่ม Admin
- 🆕 **บอร์ด BA** ที่ `/ba/` (repo Dashboard_BA · DB `ba` แยก) — ฝั่ง portal พร้อมแล้ว · เปิดบน server ตาม [docs/BA-ONBOARDING.md](docs/BA-ONBOARDING.md#ภาคผนวก--ฝั่ง-server-ข้าวทำ-ครั้งเดียว)
- ⏳ **บอร์ด QA** — ยังไม่เปิดบน server · ทีม tester แก้ repo เองผ่าน PR (ข้าวรีวิว + merge `Main`) → [docs/BOARD-INTEGRATION.md](docs/BOARD-INTEGRATION.md)
- 📝 **TODO ข้าว** (ปิด SSH password ฯลฯ) → ท้ายตาราง P0 ใน [docs/STATUS.md](docs/STATUS.md)
- server เก่า `203.150.48.37` เลิกใช้แล้ว

## Stack + โครงสร้าง
- **backend** `server/` — Node 20 + Express + Prisma + PostgreSQL (JavaScript, ESM)
- **frontend** `web/` — React 18 + Vite + TypeScript + Tailwind + Recharts
- **deploy** — Docker (`docker-compose.prod.yml` + `bootstrap.sh`)
```
server/src/{config,lark,etl,domain,api,jobs,db}/   # ดู docs/ARCHITECTURE.md
web/src/{lib,components,pages}/
docs/                                              # เอกสาร operational
00-MASTER.md … 06-BUILD-PLAN.md                    # สเปกกลาง (อ่านก่อนแก้ logic)
```

## รันเครื่อง dev (local)
```bash
# DB: postgres local หรือ docker compose up -d
cd server && npm install && npx prisma migrate deploy && npm run seed
npm run lark:authorize   # ครั้งแรก (ดู docs/DEV.md)
node src/index.js        # API :3000
cd ../web && npm install && npm run dev   # :5173 (proxy /api → :3000)
cd server && npm run test:ci   # unit tests (npm test = รวม integration ต้องมี DB)
```

## 🔴 กติกา Git (ห้ามละเมิด — คน + AI)
- **ห้าม push เข้า `main` ตรง ๆ เด็ดขาด** · ทุกอย่างผ่าน branch + PR เท่านั้น
- **AI/agent ห้าม push `main` ทุกกรณี** เว้นแต่ข้าวสั่งชัดเจน ณ ตอนนั้น (คำสั่งเก่าไม่นับ)
- merge main = ขึ้น production ทันที (auto-deploy) → คน merge ได้ = ข้าวเท่านั้น
- กฏเขียน code/มาตรฐาน/infra เต็ม → **[docs/CONVENTIONS.md](docs/CONVENTIONS.md)**

## กติกาที่ห้ามละเมิด (จาก 00-MASTER §12)
1. ตัวเลขทุกตัวต้องไล่กลับไปหาการ์ดใน Lark ได้ (drill-down + ลิงก์)
2. KPI กับ list ที่อธิบายมัน มาจาก query เดียวกัน
3. pagination วนจน `has_more=false` เสมอ
4. ETL ล้ม → เก็บข้อมูลรอบก่อน ห้ามล้างตาราง
5. **ไม่มีชื่อลูกค้าจริงในโค้ด/seed/test** — ใช้ `project_code`
6. ทุก mutation ลง AuditLog
7. secret (LARK_APP_SECRET, token) อยู่ backend เท่านั้น · `.env*` ไม่ขึ้น git

## Lark gotchas (เจ็บมาแล้ว — ดู docs/ARCHITECTURE.md)
- **3 host แยก**: task/contact = `open-sg` · authorize = `accounts` · token = `open.larksuite.com`
- sections endpoint = `/task/v2/sections?resource_type=...` (query param, ไม่ใช่ path)
- task list ย่อ → ต้อง list ต่อ section · `due.timestamp` (ms)
- refresh token หมุนทุกครั้ง → เขียนทับทันที

## เอกสาร
- `docs/STATUS.md` — ทำแล้ว/จะทำ/roadmap/blocked-on
- `docs/ARCHITECTURE.md` — โครงโค้ด, data model, API, Lark
- `docs/DEV.md` — setup, authorize, test
- `docs/MAINTAINING.md` — re-authorize, backup, เพิ่มบอร์ด, troubleshoot
- `docs/CONVENTIONS.md` — **กฏเขียน code + มาตรฐาน + infra + git** (อ่านก่อนส่ง PR)
- `docs/DEPLOY.md` — cloud deploy (docker + IP + dev-mode)
- `docs/CICD.md` — **auto-deploy**: merge main → GitHub Actions → GHCR → Watchtower (pull-based)
- `docs/CLOUDFLARE-TUNNEL.md` — **HTTPS ฟรี ไม่ต้องเปิด port** (สำหรับ staging + domain บริษัท)
- `docs/POC-DEPLOY.md` — **POC hosting**: VPS (Vultr) + DuckDNS + Caddy + Lark SSO
- `docs/MIGRATION-POC-TO-STAGING.md` — **แผนย้าย** POC → staging (swap env+ingress อย่างเดียว)
- `docs/BOARD-INTEGRATION.md` — **portal หลายแผนก**: สัญญาเชื่อมบอร์ดแผนก (QA ที่ `/qa/`) + flow PR/รีวิว + template CI + checklist repo Dashboard_Tester
- `docs/BA-ONBOARDING.md` — **ส่งทีม BA**: เอาบอร์ด BA ขึ้น `/ba/` · DB `ba` แยก · flow PR/deploy · template CI
- `docs/NEXT-SSO.md` — แผน Lark SSO + HTTPS (ทำเสร็จแล้ว — เก็บไว้อ้างอิง)
