# CONVENTIONS — กฏการเขียน code + มาตรฐาน + infra

> อ่านก่อนเขียนโค้ด/ส่ง PR ทุกครั้ง · ใช้กับทั้งคน (น้อง dev) และ AI (Claude/agent)
> เป้าหมาย: โค้ดอ่านง่าย ตัวเลขเชื่อถือได้ deploy ไม่พัง

---

## 0. 🔴 กฏเหล็ก Git (ห้ามละเมิดเด็ดขาด)

1. **ห้าม push เข้า `main` ตรง ๆ เด็ดขาด** — ทุกอย่างต้องผ่าน branch + Pull Request เท่านั้น
2. **AI/agent ห้าม push `main` ทุกกรณี** เว้นแต่ข้าวสั่งชัดเจนในตอนนั้น (คำสั่งเก่าไม่นับ)
3. **merge เข้า main = ขึ้น production ทันที** (auto-deploy) → main ต้องเขียวเสมอ (test ผ่าน)
4. คนที่ merge PR ได้ = **ข้าว (PM) เท่านั้น** หลังรีวิว
5. ทำงานบน branch → เปิด PR → ข้าวรีวิว → ข้าว merge → server อัพเดทเอง

> เหตุผล: main ต่อกับ auto-deploy ตรง ๆ (ดู `docs/CICD.md`) — push มั่ว = ระบบจริงพังทันที

### Branch naming
```
feature/<เรื่องสั้น ๆ>      เช่น feature/qa-dashboard
fix/<เรื่องสั้น ๆ>          เช่น fix/gantt-overflow
chore/<เรื่องสั้น ๆ>        เช่น chore/bump-prisma
```
- 1 branch = 1 เรื่อง · เล็ก · รีวิวง่าย
- rebase/merge main ล่าสุดก่อนเปิด PR

### Commit message (Conventional Commits)
```
<type>(<scope>): <สรุปสั้น ภาษาไทยได้>

<รายละเอียด — ทำไม ไม่ใช่แค่ทำอะไร>
```
`type` = `feat` `fix` `chore` `docs` `test` `refactor` `ci` `perf`
ตัวอย่าง: `feat(qa): หน้า QA dashboard — bug 4 ข้อ + throughput`

---

## 1. กติกาที่ห้ามละเมิด (จาก 00-MASTER §12 — ธุรกิจ)

1. ตัวเลขทุกตัวต้องไล่กลับไปหาการ์ดใน Lark ได้ (drill-down + ลิงก์)
2. KPI กับ list ที่อธิบายมัน **มาจาก query เดียวกัน** (ห้ามคำนวณ 2 ทาง)
3. pagination วนจน `has_more=false` เสมอ
4. ETL ล้ม → เก็บข้อมูลรอบก่อน **ห้ามล้างตาราง**
5. **ไม่มีชื่อลูกค้าจริงในโค้ด/seed/test** — ใช้ `project_code`
6. ทุก mutation ลง **AuditLog** (`writeAudit`)
7. secret (`LARK_APP_SECRET`, token) อยู่ backend เท่านั้น · `.env*` ไม่ขึ้น git

---

## 2. Backend (`server/` — Node 20 + Express + Prisma, JavaScript ESM)

- **ESM เท่านั้น** — `import`/`export`, ไฟล์ลงท้าย `.js` ใน import path (`'../db/prisma.js'`)
- **named export** เป็นหลัก (เช่น `export const adminRouter`) · เลี่ยง default export
- **โครงโฟลเดอร์** — ทำตามที่มี ห้ามสร้าง layer ใหม่มั่ว:
  ```
  config/  env + ค่าคงที่        lark/    client + auth + tasks (เรียก Lark)
  etl/     sync + postprocess     domain/  logic ธุรกิจ (bucket, status, audit, enums)
  api/     routes + middleware    db/      prisma client (จุดเดียว)
  jobs/    cron
  ```
- **prisma ผ่านจุดเดียว** — `import { prisma } from '../db/prisma.js'` ห้าม `new PrismaClient()` กระจาย
- **ทุก mutation** → เรียก `writeAudit(...)` (กฏ §6)
- **ทุก route ที่แก้ข้อมูล** → มี `requireRole('ADMIN','PM')` (หรือ role ที่เหมาะสม)
- **คอมเมนต์อ้างสเปก** — เขียนกำกับว่า logic มาจากไหน เช่น `// MASTER §5` `// DATA-LAYER §2`
- **JSDoc** สำหรับ function ที่ logic ไม่ชัด (โดยเฉพาะ domain)
- **async/await** ล้วน · จับ error ที่ขอบ (route/job) ไม่ใช่กลาง logic
- **ห้าม hardcode ค่าที่ควรมาจาก DB/env** (weight, redirect uri, host)
- **เลข/เวลา** — timezone `Asia/Bangkok`, `due.timestamp` เป็น ms (ดู Lark gotchas)

## 3. Frontend (`web/` — React 18 + Vite + TS + Tailwind + Recharts)

- **TypeScript จริงจัง** — ห้าม `any` ลอย ๆ · `build` = `tsc -b && vite build` → **type error = build พัง = ไม่ deploy**
- **โครง** `web/src/{lib,components,pages}/` — `lib/` = api client + auth, `pages/` = 1 หน้า, `components/` = ใช้ซ้ำ
- เรียก API ผ่าน `lib/` เท่านั้น (อย่ายิง fetch กระจายในหน้า)
- **ไม่มี secret ฝั่ง web** — ทุก secret อยู่ backend (กฏ §7)
- สี/สไตล์ตาม Executive theme เดิม (navy AppShell) — เข้าชุดกันทุกหน้า

## 4. Testing

- **แก้ logic domain/etl → ต้องมี/อัปเดต test** (vitest ใน `server/test/`)
- **unit test** = mock prisma/lark (ดู `auth.test.js`) → รันที่ไหนก็ได้ · **CI รันชุดนี้**
- **integration test** ที่ต้องมี DB + ข้อมูล sync จริง (เช่น `pm-api.test.js`) → รันบนเครื่องที่มีข้อมูล ไม่รันใน CI
- ก่อน push: `cd server && npm test` (มีข้อมูล) หรืออย่างน้อย `npm run test:ci`
- **CI จะ block merge ถ้า `test:ci` ไม่ผ่าน** (เมื่อเปิด branch protection)

## 5. Database / Prisma migration

- แก้ schema → `npx prisma migrate dev --name <ชื่อ>` → commit ไฟล์ migration ด้วย
- **migration ต้อง forward-only + ปลอดภัย** — production รัน `migrate deploy` เองตอน container start
- ห้าม `migrate reset` / drop table บน production (กฏ §4)
- seed idempotent เสมอ (รันซ้ำได้ ไม่พัง)

## 6. Secrets / env

- `.env*` **ห้ามขึ้น git** (มี `.gitignore` แล้ว) · มี `.env.example` เป็น template
- secret ใหม่ → เพิ่มใน `config/env.js` + เอกสาร + `.env.example` (ใส่ค่าปลอม)
- production secret อยู่บน server (`server/.env.production`) เท่านั้น

---

## 7. Infra / CI-CD (ดูเต็ม → `docs/CICD.md`)

```
push branch → PR → รีวิว → merge main
   → GitHub Actions: test(51 unit) → build image server+web → push GHCR
   → Watchtower บน server ดึงมา deploy เอง (migrate อัตโนมัติ)
```

- **build ที่ CI ไม่ใช่ที่ server** — server แค่ pull image (`docker-compose.prod.yml` ใช้ `image:` ไม่ใช่ `build:`)
- **อย่าทำ image พัง** — ก่อน merge: backend `npm run test:ci` ผ่าน + frontend `npm run build` ผ่าน (tsc)
- **migrate อัตโนมัติ** — อยู่ใน `server/Dockerfile` (`prisma migrate deploy` ตอน start) อย่าเอาออก
- **image tag**: `latest` (watchtower ตาม) + `sha-<commit>` (ไว้ rollback)
- **rollback**: ตั้ง `IMAGE_TAG=sha-<commit>` ใน `.env` server → `bash deploy.sh`
- **env/token คงอยู่**ข้าม deploy — env อยู่ host, OAuth token อยู่ DB (volume `pgdata`)
- อย่า commit `docker-compose` ที่ publish port 5432/3000 ออก public (3000 = localhost only)

### แนะนำเปิด (ต้อง admin repo — ข้าว)
- **Branch protection บน `main`**: require PR + require status check `test` ผ่าน + ห้าม push ตรง
  → บังคับกฏข้อ 0 ให้เป็นจริงระดับ GitHub (คนลืมก็ push main ไม่ได้)

---

## 8. Checklist ก่อนเปิด PR
- [ ] อยู่บน branch (ไม่ใช่ main) · 1 branch = 1 เรื่อง
- [ ] `cd server && npm run test:ci` ผ่าน (+ `npm test` ถ้ามีข้อมูล)
- [ ] `cd web && npm run build` ผ่าน (tsc ไม่ error)
- [ ] mutation ใหม่ → มี `writeAudit` + role guard
- [ ] ไม่มีชื่อลูกค้าจริง / secret หลุดในโค้ด
- [ ] migration commit ครบ (ถ้าแก้ schema)
- [ ] คอมเมนต์อ้างสเปก § ที่เกี่ยวข้อง
- [ ] commit message เป็น Conventional Commits
