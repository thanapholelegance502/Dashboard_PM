# 00 — MASTER SPEC · Elegance PMO Dashboard (Multi-Department)

> **อ่านไฟล์นี้ก่อนเสมอ** ไฟล์อื่นทุกไฟล์อ้างกติกา ชื่อตาราง และ code ที่นิยามไว้ในนี้
> ผู้สั่งงาน: ข้าว (PM, Elegance Consultant) · วันที่ล็อกสเปก: 18 ก.ย. 2026
> เป้าหมาย: แทนที่ prototype บน Genspark ด้วยระบบของเราเอง รองรับ dashboard 4 แผนก (PM · QA · BA · UX/UI) จากข้อมูลจริงใน Lark Task

---

## 0. ลำดับการอ่าน / ไฟล์ในชุดนี้

| ไฟล์ | เนื้อหา | เฟส |
|---|---|---|
| `00-MASTER.md` | สถาปัตยกรรม, DB schema, bucket engine, auth, กติกากลาง ← **ไฟล์นี้** | – |
| `01-DATA-LAYER.md` | Lark API client, OAuth, ETL, snapshot | P1 |
| `02-PM-DASHBOARD.md` | **แผนกแรกที่ต้องทำ** — เต็มรูปแบบ | P2 |
| `03-QA-DASHBOARD.md` | พอร์ตจาก Genspark + แก้ 4 บั๊ก | P4 |
| `04-BA-DASHBOARD.md` | โครง + custom field ที่ต้องเพิ่มก่อน | P5 |
| `05-UXUI-DASHBOARD.md` | โครง + custom field ที่ต้องเพิ่มก่อน | P6 |
| `06-BUILD-PLAN.md` | task list + dependency + สิ่งที่ยังติดรอคำตอบ | – |

**คำสั่งถึง Claude Code:** ทำตามลำดับ P1 → P2 ก่อน หยุดให้ข้าว review แล้วค่อยไป P3+
อย่าเริ่มไฟล์ 04/05 จนกว่า blocked-on ของไฟล์นั้นจะถูกปลด

---

## 1. กติกาที่ล็อกแล้ว (confirm โดยข้าว — ห้ามเปลี่ยนเอง)

1. **Data source = Lark Task API เท่านั้น** (ไม่ใช่ Bitable) บอร์ดเดิมที่ทีมใช้อยู่ ไม่ย้ายระบบ ไม่เปลี่ยนพฤติกรรมทีม
   ตัวเลขที่ Task ให้ไม่ได้ → เพิ่ม **custom field** บน tasklist ทีละแผนก (ค่อยทำ ไม่ใช่เฟสแรก)
2. **1 tasklist = 1 โปรเจกต์** — project master = list ของ tasklist guid
3. **สถานะงานมาจากชื่อ section เท่านั้น** ไม่ใช้ native `completed` ของ Lark
   (การ์ดที่เทสเสร็จอาจยังไม่ถูกติ๊ก done — ดู section เป็นหลัก)
4. **map ด้วย "ชื่อ section" ไม่ hardcode guid** — เก็บเป็น rule ใน DB แก้ได้จากหน้า Admin
5. **Active = งานที่ยังทำอยู่เท่านั้น** (ไม่รวมงานที่เสร็จแล้ว) — แก้บั๊กนิยามกำกวมของ Genspark
6. **"เสร็จสัปดาห์นี้" = snapshot** — นับการ์ดที่อยู่ใน bucket DONE ณ วันที่ snapshot
   (สัปดาห์แรกตัวเลขเท่ายอดสะสม · พอสะสม snapshot ≥2 สัปดาห์ ระบบคำนวณ delta จริงเพิ่มให้อัตโนมัติ)
7. **ตัวเลขที่ Lark ไม่มี** → config กรอกมือ (milestone/target/forecast) + custom field (defect/QA result)
8. **Config กรอกผ่านหน้า Admin ในระบบ** เซฟลง DB + audit log — ไม่ใช่ไฟล์ YAML
9. **Progress % = ถ่วงน้ำหนักตาม section** (ไม่ใช่นับเฉพาะการ์ดที่เสร็จ)
10. **สถานะโปรเจกต์ = auto + PM override พร้อมเหตุผลบังคับ**
11. **Sync = cron 08:00 และ 17:00 (Asia/Bangkok) + ปุ่ม Run now** — ไม่ใช่ทุก 60 วิ
12. **Hosting เฟสแรก = local** → เสร็จแล้วขึ้น server บริษัท + **Lark SSO login**
    ออกแบบ auth ให้เสียบ SSO ได้ตั้งแต่แรก อย่าทำ auth แบบชั่วคราวที่รื้อยาก
13. **ห้ามใส่ชื่อลูกค้าจริงในโค้ด/เอกสาร/seed data** ใช้ `project_code` และ `tasklist_guid` เท่านั้น
    ชื่อจริงกรอกในหน้า Admin (เก็บใน DB บน server) — ถ้าเจอชื่อลูกค้าใน string ไหนให้ถามก่อน อย่าเดา
14. **Secret (LARK_APP_SECRET, refresh_token) อยู่ฝั่ง backend เท่านั้น** ห้ามหลุดไป frontend ทุกกรณี

---

## 2. Insight ที่ทำให้ระบบนี้ไม่ต้องทำ 4 ระบบ

บอร์ดโปรเจกต์ 1 บอร์ดใน Lark **มี section ของทุกแผนกอยู่ด้วยกันแล้ว**
ตัวอย่างจริงจากบอร์ด `AUS_SILVER` (ยืนยันแล้ว 18 ก.ย. — 132 การ์ด):

```
Waiting for Client · PM-Planning · BA · UXUI · Ready for Dev · Dev-In Progress ·
Dev-Ready for Deploy · Ready for Test · Testing · Ready for UAT · UAT · Ready for PROD · PROD
```

→ **ETL ตัวเดียว ดึงครั้งเดียว เก็บลงตารางเดียว** แล้วให้ dashboard แต่ละแผนก query ด้วย `dept_code` ต่างกัน
นี่คือหัวใจสถาปัตยกรรม อย่าทำ pipeline แยกต่อแผนก

```
Lark Task API ──► ETL ──► task (1 ตาราง) ──┬──► /api/pm/*    (dept: ทุกแผนก รวมเป็นภาพโปรเจกต์)
                            │               ├──► /api/qa/*    (dept_code = 'QA')
                            │               ├──► /api/ba/*    (dept_code = 'BA')
                            │               └──► /api/uxui/*  (dept_code = 'UXUI')
                            └──► snapshot รายวัน ──► trend / throughput
```

---

## 3. Stack

| ชั้น | เลือกใช้ | เหตุผล |
|---|---|---|
| Runtime | **Node.js 20 LTS** | ข้าวถนัด |
| Backend | **Express 4 + TypeScript** | ถนัด Express อยู่แล้ว · TS กัน bug ตอน map field จาก Lark |
| ORM | **Prisma** | migration ชัด, type-safe, Claude Code ทำงานกับมันง่าย |
| DB | **PostgreSQL 16** (docker-compose ตอน local) | ข้าวเลือก full function + database · jsonb ใช้เก็บ custom_fields ได้ดี |
| Scheduler | **node-cron** ใน process เดียวกับ API | ระบบเล็ก ไม่ต้องแยก worker |
| Frontend | **React 18 + Vite + TypeScript + TailwindCSS** | |
| Charts | **Recharts** (line / donut / stacked bar) | |
| Gantt | **เขียนเอง** เป็น component SVG/CSS grid | Recharts ไม่มี gantt · ดู `02-PM-DASHBOARD.md` §6 |
| Auth | **Lark OAuth (SSO)** + session cookie httpOnly | ใช้ Lark app ตัวเดิม |

> ถ้า Claude Code อยากใช้ JavaScript ล้วนแทน TypeScript — ทำได้ ไม่กระทบสถาปัตยกรรม แต่ต้องคง Prisma ไว้

### โครง repo

```
pmo-dashboard/
├─ docker-compose.yml           # postgres สำหรับ local
├─ .env.example
├─ docs/                        # ไฟล์ .md ชุดนี้ทั้งหมด
├─ server/
│  ├─ prisma/schema.prisma
│  ├─ prisma/seed.ts            # seed section_rule + bucket + dept (ไม่มีชื่อลูกค้า)
│  └─ src/
│     ├─ config/env.ts
│     ├─ lark/
│     │  ├─ client.ts           # axios instance ชี้ host SG + retry
│     │  ├─ auth.ts             # OAuth + refresh token rotation
│     │  ├─ tasks.ts            # tasklist / sections / tasks (+ pagination)
│     │  └─ contacts.ts         # users/batch
│     ├─ etl/
│     │  ├─ extract.ts
│     │  ├─ transform.ts        # ใช้ domain/bucket.ts
│     │  ├─ load.ts
│     │  └─ snapshot.ts
│     ├─ domain/
│     │  ├─ bucket.ts           # section name → { dept_code, bucket_code, weight }
│     │  ├─ progress.ts         # weighted progress
│     │  ├─ status.ts           # On Track / At Risk / Delayed + override
│     │  └─ kpi/{pm,qa,ba,uxui}.ts
│     ├─ api/
│     │  ├─ routes/{pm,qa,ba,uxui,admin,sync,auth,meta}.ts
│     │  └─ middleware/{auth,role,error}.ts
│     ├─ jobs/cron.ts
│     └─ index.ts
└─ web/
   └─ src/
      ├─ pages/{PM,QA,BA,UXUI,Admin,Login}.tsx
      ├─ components/{KpiCard,GanttTimeline,StatusBadge,DonutChart,StackedBar,TrendLine,AttentionTable,FilterBar}.tsx
      └─ lib/{api.ts,format.ts,theme.ts}
```

---

## 4. Enum กลาง (ใช้ร่วมทุกไฟล์ — ห้ามตั้งชื่อใหม่)

### 4.1 `dept_code`
```
PM · BA · UXUI · DEV · QA · NONE
```
`NONE` = section ที่ยังไม่มี rule (ต้องขึ้นเตือนในหน้า Admin ให้คนไป map)

### 4.2 `bucket_code`
```
BACKLOG      งานเข้าคิวของแผนกนั้น ยังไม่เริ่ม
IN_PROGRESS  กำลังทำ
WAITING      ทำไม่ได้เพราะรอฝั่งอื่น (ลูกค้า/แผนกอื่น) — ยังนับเป็น "ค้าง"
DONE         จบในมุมของแผนกนั้น
BLOCKED      ติดปัญหา ต้องมีคนแก้
```
> `BLOCKED` เป็น bucket ปกติ **ไม่ใช่ flag แยก** — นี่คือจุดที่แก้บั๊ก Genspark ข้อ 1 (ตัวนับกับ list ดึงคนละที่)
> KPI blocker และ list blocker ต้อง query จาก `bucket_code = 'BLOCKED'` **query เดียวกัน** เสมอ

### 4.3 สูตร KPI มาตรฐาน (ทุกแผนกใช้เหมือนกัน)
```ts
ค้าง (open)   = count(bucket in [BACKLOG, IN_PROGRESS, WAITING])
เสร็จ (done)  = count(bucket = DONE)
blocker       = count(bucket = BLOCKED)
Active        = ค้าง                       // ล็อกแล้ว — ไม่รวม done
overdue       = count(due_at < today AND bucket NOT IN [DONE])
% เสร็จ       = done / (ค้าง + done) * 100  // BLOCKED ไม่อยู่ใน denominator
```

### 4.4 `project_status`
```
ON_TRACK · AT_RISK · DELAYED · DONE
```

---

## 5. Section → (dept, bucket, weight) — Rule Engine

**เก็บใน DB ตาราง `section_rule` แก้จากหน้า Admin ได้ ไม่ hardcode ในโค้ด**

การ match ทำตามลำดับ `priority` น้อย→มาก เจอตัวแรกที่ match แล้วหยุด:

| priority | match_type | pattern | dept | bucket | weight |
|---|---|---|---|---|---|
| 10 | contains (case-insensitive) | `block` | *(คงตาม section เดิมไม่ได้ → ใช้ `NONE` แล้วให้ dept มาจาก rule ถัดไปถ้ามี)* | `BLOCKED` | 50 |
| 20 | exact | `Waiting for Client` | BA | WAITING | 5 |
| 20 | exact | `PM-Planning` | PM | IN_PROGRESS | 10 |
| 20 | exact | `BA` | BA | IN_PROGRESS | 20 |
| 20 | exact | `UXUI` | UXUI | IN_PROGRESS | 30 |
| 20 | exact | `Ready for Dev` | DEV | BACKLOG | 35 |
| 20 | exact | `Dev-In Progress` | DEV | IN_PROGRESS | 50 |
| 20 | exact | `Dev-Ready for Deploy` | DEV | DONE | 65 |
| 20 | exact | `Ready for Test` | QA | BACKLOG | 70 |
| 20 | exact | `Testing` | QA | IN_PROGRESS | 75 |
| 20 | exact | `Ready for UAT` | QA | WAITING | 80 |
| 20 | exact | `Staging UAT` | QA | WAITING | 82 |
| 20 | exact | `UAT` | QA | DONE | 88 |
| 20 | exact | `Ready for PROD` | QA | DONE | 95 |
| 20 | exact | `PROD` | QA | DONE | 100 |
| 20 | exact | `DONE` | QA | DONE | 100 |
| 20 | exact | `Fail bug` | QA | DONE | 60 |
| 999 | fallback | `*` | NONE | BACKLOG | 0 |

**หมายเหตุสำคัญ**
- `Fail bug` = **DONE ในมุม tester** (เทสจบแล้ว ส่งกลับ dev) แต่ weight ต่ำ (60) เพราะงานจริงถอยหลัง — ตั้งใจให้ต่างกัน
- `Ready for UAT → WAITING` และ `Ready for PROD → DONE` เป็นค่า default ที่ผมตั้ง **⚠️ ยังรอข้าวยืนยัน** (บอร์ด `AUS_SILVER` เป็น 0 ทั้งคู่จึงยังไม่กระทบตัวเลข regression)
- section ที่ไม่ match rule ไหนเลย → `dept=NONE` และ **ต้องขึ้น banner เตือนในหน้า Admin** พร้อมจำนวนการ์ดที่ค้างอยู่ ห้ามเงียบ
- ⚠️ **ยังไม่มี section list ของโปรเจกต์อื่นนอกจาก `AUS_SILVER`** → ดู §9 blocked-on

---

## 6. Database Schema (Prisma — โครงหลัก)

```prisma
model Project {
  id                   Int      @id @default(autoincrement())
  projectCode          String   @unique          // AUS_SILVER, MYGOLD_BSEA, LKN
  displayName          String                     // กรอกในหน้า Admin เท่านั้น ห้าม seed
  larkTasklistGuid     String   @unique
  pmUserId             Int?                       // → Member
  isActive             Boolean  @default(true)
  sortOrder            Int      @default(0)

  startDate            DateTime?
  targetUat            DateTime?
  targetGolive         DateTime?
  forecastUat          DateTime?
  forecastGolive       DateTime?
  actualUat            DateTime?
  actualGolive         DateTime?

  statusOverride       String?                    // ON_TRACK | AT_RISK | DELAYED | null
  statusOverrideReason String?
  statusOverrideBy     Int?
  statusOverrideAt     DateTime?
  progressOverride     Int?                       // 0-100, null = ใช้ค่าคำนวณ

  tasks                Task[]
  attentionItems       AttentionItem[]
}

model SectionRule {
  id         Int    @id @default(autoincrement())
  matchType  String                // EXACT | CONTAINS | FALLBACK
  pattern    String
  deptCode   String
  bucketCode String
  weight     Int                   // 0-100 ใช้คำนวณ progress
  priority   Int    @default(20)
  projectId  Int?                  // null = ใช้ทุกโปรเจกต์, มีค่า = override เฉพาะโปรเจกต์นั้น
  isActive   Boolean @default(true)
}

model Member {
  id          Int     @id @default(autoincrement())
  larkOpenId  String  @unique
  displayName String
  nickname    String?
  deptCode    String                // PM | BA | UXUI | DEV | QA
  isActive    Boolean @default(true)
}

model Task {
  id              Int       @id @default(autoincrement())
  larkTaskGuid    String    @unique
  projectId       Int
  sectionGuid     String
  sectionName     String                 // เก็บชื่อไว้ด้วย เผื่อ section ถูกลบใน Lark
  title           String
  larkUrl         String?
  assigneeOpenIds Json                   // string[]
  creatorOpenId   String?
  dueAt           DateTime?
  completedAt     DateTime?              // native ของ Lark — เก็บไว้ดู ไม่ใช้ตัดสินสถานะ
  larkCreatedAt   DateTime?
  larkUpdatedAt   DateTime?
  customFields    Json?                  // { severity, work_type, module, rework_count, ... }

  deptCode        String                 // คำนวณจาก SectionRule ตอน transform
  bucketCode      String
  sectionWeight   Int

  lastSeenAt      DateTime               // ใช้ soft-delete การ์ดที่หายไปจาก Lark
  isDeleted       Boolean  @default(false)

  @@index([projectId, deptCode, bucketCode])
}

model TaskStateSnapshot {              // ต่อการ์ด ต่อวัน — ใช้คำนวณ delta/throughput ย้อนหลังได้จริง
  id           Int      @id @default(autoincrement())
  snapshotDate DateTime @db.Date
  larkTaskGuid String
  projectId    Int
  deptCode     String
  bucketCode   String
  sectionName  String
  @@unique([snapshotDate, larkTaskGuid])
  @@index([snapshotDate, projectId, deptCode])
}

model DailyAggregate {                 // สรุปแล้ว query เร็ว สำหรับกราฟ trend
  id           Int      @id @default(autoincrement())
  snapshotDate DateTime @db.Date
  projectId    Int
  deptCode     String
  bucketCode   String
  taskCount    Int
  progressPct  Int?
  @@unique([snapshotDate, projectId, deptCode, bucketCode])
}

model AttentionItem {                  // "CEO Attention Required" — PM กรอกเอง + ระบบ auto-suggest
  id         Int      @id @default(autoincrement())
  projectId  Int
  title      String
  issueType  String                    // DECISION | RESOURCE | SCOPE | RISK
  impactText String
  neededBy   DateTime?
  status     String   @default("OPEN") // OPEN | RESOLVED
  source     String   @default("MANUAL") // MANUAL | AUTO
  createdBy  Int?
  createdAt  DateTime @default(now())
  resolvedAt DateTime?
}

model SyncRun {
  id           Int      @id @default(autoincrement())
  startedAt    DateTime @default(now())
  finishedAt   DateTime?
  status       String                  // RUNNING | SUCCESS | FAILED | PARTIAL
  trigger      String                  // CRON | MANUAL
  tasksFetched Int      @default(0)
  pagesFetched Int      @default(0)
  projectsOk   Int      @default(0)
  projectsFail Int      @default(0)
  errorText    String?
}

model OAuthToken {
  id           Int      @id @default(autoincrement())
  provider     String   @unique        // "lark"
  accessToken  String
  refreshToken String
  expiresAt    DateTime
  updatedAt    DateTime @updatedAt
}

model AppUser {
  id          Int     @id @default(autoincrement())
  larkOpenId  String? @unique
  email       String  @unique
  displayName String
  role        String                   // ADMIN | PM | VIEWER
  isActive    Boolean @default(true)
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  appUserId Int?
  entity    String                     // Project | SectionRule | AttentionItem | Member
  entityId  String
  action    String                     // CREATE | UPDATE | DELETE | OVERRIDE
  before    Json?
  after     Json?
  reason    String?
  createdAt DateTime @default(now())
}
```

---

## 7. Auth & Role

**เฟส 1 (local):** `.env` เปิด `AUTH_MODE=dev` → auto-login เป็น AppUser id 1 (role ADMIN)
**เฟส 2 (server บริษัท):** `AUTH_MODE=lark_sso`

Flow SSO ใช้ Lark app ตัวเดิม:
```
/api/auth/login  → redirect ไป Lark authorize
/api/auth/callback → แลก code → ได้ open_id + email
                   → หา AppUser ด้วย larkOpenId/email
                   → ไม่พบ = ปฏิเสธ (whitelist only, ไม่ auto-create)
                   → set session cookie httpOnly + sameSite=lax
```

| role | เห็นอะไร |
|---|---|
| `ADMIN` | ทุกแผนก + หน้า Admin + ปุ่ม Sync now |
| `PM` | ทุกแผนก + แก้ milestone/status override เฉพาะโปรเจกต์ที่ตัวเองเป็น PM + ปุ่ม Sync now |
| `VIEWER` | ดูอย่างเดียว (หัวหน้าทีมแต่ละแผนก / CEO) |

> ⚠️ อย่าเขียน auth ชั่วคราวแบบ hardcode password ในโค้ด — ทำ interface `AuthProvider` แล้วมี 2 implementation (`DevAuth`, `LarkSsoAuth`) สลับด้วย env

---

## 8. Sync & Snapshot

```
cron "0 8 * * *"  Asia/Bangkok  → runSync({ trigger: 'CRON' })
cron "0 17 * * *" Asia/Bangkok  → runSync({ trigger: 'CRON' }) แล้วต่อด้วย writeSnapshot()
POST /api/sync/run (ADMIN|PM)   → runSync({ trigger: 'MANUAL' }) — มี lock กันกดซ้อน
```

- `writeSnapshot()` เขียน `TaskStateSnapshot` (ทุกการ์ด) + `DailyAggregate` (สรุป) ของวันนั้น
- เขียนซ้ำวันเดิม = upsert (กดซ้ำได้ ไม่เละ)
- **สัปดาห์หนึ่ง = ISO week** · ค่าประจำสัปดาห์ = snapshot ของ **วันศุกร์** (ถ้าไม่มี ใช้ snapshot ล่าสุดในสัปดาห์นั้น)
- Sync ล้มเหลวบางโปรเจกต์ → status `PARTIAL`, ห้ามลบข้อมูลเก่าของโปรเจกต์ที่ดึงไม่ได้ และต้องแสดง badge เตือนบน UI ว่าข้อมูลโปรเจกต์ไหนเก่า

---

## 9. ⛔ Blocked-on — ยังรอคำตอบ/ข้อมูล ห้ามเดา

| # | ติดอะไร | กระทบอะไร | ใครปลด |
|---|---|---|---|
| ~~B1~~ ✅ | ~~Section list ของโปรเจกต์อื่น~~ **ปลดแล้ว 18 ก.ย.** — ดึง section จริงครบ 3 บอร์ด, แต่ละบอร์ดตั้งชื่อคนละแบบ → ทำ **per-project `section_rule`** (priority 15) ใน seed แล้ว · dept ข้าวยืนยัน · weight ก้อนใหญ่ (Test Success 144ใบ, ✅Passed 200ใบ, Cancel) = DONE/95 ข้าวรับแล้ว | – | – |
| ~~B2~~ ✅ | ~~Blocker section~~ **ปลดแล้ว** — `MYGOLD_BSEA` มี section `Blocker` (6 ใบ) · rule `contains 'block'` → `bucket=BLOCKED` · KPI+list query เดียวกัน | – | – |
| B3 | **ยืนยัน `Ready for UAT → WAITING` / `Ready for PROD → DONE`** (ยังไม่มีบอร์ดไหนใช้ชื่อ section เป๊ะนี้ → ยังไม่กระทบ) | KPI QA + progress | ข้าว |
| B4 | **ยืนยันตาราง weight ต่อ section ใน §5** | progress % ทุกโปรเจกต์ | ข้าว |
| B5 | **open_id + แผนกของสมาชิกทุกคน** (ไม่ใช่แค่ 4 tester) | donut workload ทุกแผนก | ข้าว (ดึงจาก API แล้วให้ข้าว tag แผนกในหน้า Admin ได้) |
| B6 | **นโยบายการ์ดที่ไม่มี assignee** — จัดเป็น "ไม่ระบุผู้รับผิดชอบ" / ตัดออก / นับตามผู้สร้าง | donut workload (บั๊ก Genspark ข้อ 2) | ข้าว |
| B7 | **รายชื่อโปรเจกต์ทั้งหมด + PM เจ้าของแต่ละตัว** | PM dashboard view "By PM" | ข้าว |
| B8 | **Lark app credentials สำหรับ SSO** (redirect URI ของ server บริษัท) | เฟส deploy เท่านั้น | ข้าว + IT |

> **วิธีทำงานเมื่อติด blocked-on:** สร้างโครงโค้ดให้ครบ + ใส่ค่า default ตาม §5 + เขียน test ที่ fail อย่างมีความหมาย แล้ว**หยุดรายงานข้าว** อย่าเดาค่าแล้วเดินต่อ

---

## 10. Regression Test บังคับ (ต้องผ่านก่อนส่งงานทุกเฟส)

**บอร์ด `AUS_SILVER` (guid `4e5f2452-c3d5-4d68-8d3f-1da9c0aa538d`) — ยืนยันด้วยตาเมื่อ 18 ก.ย.**

```
จำนวนการ์ดทั้งบอร์ด                     = 132   ← ถ้าได้น้อยกว่านี้ = pagination พัง
Waiting for Client  4   PM-Planning  3   BA  2   UXUI  0
Ready for Dev       3   Dev-In Progress 70  Dev-Ready for Deploy  9
Ready for Test     41   Testing      0   Ready for UAT 0
UAT                 0   Ready for PROD 0  PROD 0
```

ค่าที่ระบบต้องคำนวณได้:

| ตัวชี้วัด | ค่าที่ต้องได้ |
|---|---|
| QA ค้าง | **41** |
| QA เสร็จ | **0** |
| QA Active | **41** |
| QA blocker | **0** |
| PM progress % (ตาม weight §5) | **54%** — `(4×5 + 3×10 + 2×20 + 3×35 + 70×50 + 9×65 + 41×70) / (132×100) = 7150/13200 = 54.2%` |
| total การ์ด | **132** |

> ถ้าข้าวเปลี่ยน weight ใน B4 ค่า 54% จะเปลี่ยน — ให้ test คำนวณ expected จากตาราง weight ใน DB ไม่ใช่ hardcode 54

**บั๊กที่เคยเจอและต้องมี test ครอบ:**
- pagination หยุดก่อนครบ (เคยได้ 183 จาก 281 ใบ) → test ต้อง assert ว่าวน `page_token` จน `has_more=false`
- KPI blocker กับ list blocker ไม่ตรงกัน → test ว่าทั้งคู่มาจาก query เดียวกัน

---

## 11. Design System ของ dashboard (ใช้ร่วมทุกแผนก)

ให้ทุกหน้าใช้ token ชุดเดียวกัน (ไฟล์ `web/src/lib/theme.ts`) เพื่อให้ 4 แผนกดูเป็นระบบเดียว

| ความหมาย | สี | ใช้กับ |
|---|---|---|
| On Track / สำเร็จ | เขียว | badge, bar |
| At Risk / เตือน | เหลือง-ส้ม | badge, bar |
| Delayed / วิกฤต | แดง | badge, bar, ตัวเลข overdue |
| กำลังทำ | น้ำเงิน | bar, donut |
| รอ / นอกมือเรา | เทา | bar, donut |

**กติกา chart**
- ห้ามใช้สีแดงกับอะไรที่ไม่ใช่ปัญหา — ผู้อ่านคือ CEO ต้องสแกนแล้วเจอของแดงทันที
- ทุกตัวเลข KPI ต้องคลิกได้ → drill-down ไปยังรายการการ์ดที่ประกอบเป็นตัวเลขนั้น (แก้ปัญหา "ตัวเลขไม่ตรง แล้วไล่ไม่ได้" ของ Genspark)
- ทุกหน้าแสดง `ข้อมูล ณ <วันเวลา sync ล่าสุด>` มุมขวาบน + badge แดงถ้า sync ล่าสุดเก่ากว่า 24 ชม.
- ตัวเลขว่าง/ยังไม่มีข้อมูล → แสดง `—` และ tooltip บอกว่าทำไม **ห้ามแสดง 0** (0 กับ "ไม่มีข้อมูล" คนละเรื่อง — นี่คือรากของบั๊ก Genspark ข้อ 1 และ 2)

---

## 12. หลักการที่ห้ามละเมิด (เขียนไว้เตือน Claude Code)

1. **ตัวเลขทุกตัวบนหน้าจอต้องไล่กลับไปหาการ์ดใน Lark ได้** ถ้าไล่ไม่ได้ อย่าแสดง
2. **KPI กับ list ที่อธิบาย KPI นั้น ต้องมาจาก query เดียวกัน** — ห้ามคำนวณคนละที่
3. **pagination ต้องวนจนจบเสมอ** ทุก endpoint ที่มี `page_token`
4. ETL ล้ม → เก็บข้อมูลรอบก่อนไว้ ห้ามล้างตาราง
5. ห้ามใส่ชื่อลูกค้าใน seed / test fixture / comment
6. ทุก mutation ที่คนกดจากหน้า Admin ต้องลง `AuditLog`
