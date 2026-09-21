# 06 — BUILD PLAN · Task list ส่ง Claude Code

> รูปแบบตาม skill `ถามผม` — ทุก task ประกาศสถานะ 🟢 เริ่มได้เลย / 🟡 ติดรอ
> วันที่: 18 ก.ย. 2026

---

## กติกาที่ล็อกแล้ว (หัว task — Claude Code อ่านก่อนเริ่ม)

- Data source = **Lark Task API** เท่านั้น · host **`open-sg.larksuite.com`** · auth = **user_access_token (OAuth ในนามข้าว)**
- **1 tasklist = 1 โปรเจกต์**
- สถานะงานมาจาก **ชื่อ section** ไม่ใช่ native done · map ด้วยชื่อ เก็บเป็น rule ใน DB แก้จากหน้า Admin
- **Active = งานค้างอย่างเดียว** · **"เสร็จสัปดาห์นี้" = snapshot**
- ตัวเลขที่ Lark ไม่มี = **config กรอกมือผ่านหน้า Admin** (milestone/target/forecast) + custom field (defect/QA result)
- **Progress % = ถ่วงน้ำหนักตาม section**
- **สถานะโปรเจกต์ = auto + PM override บังคับกรอกเหตุผล**
- Sync = **cron 08:00 / 17:00 (Asia/Bangkok) + ปุ่ม Run now** · snapshot ต่อท้ายรอบ 17:00
- Stack = **Node 20 + Express + TypeScript + Prisma + PostgreSQL + React/Vite/Tailwind + Recharts**
- เฟสแรกรัน **local** · ออกแบบ auth ให้เสียบ **Lark SSO** ได้ทันทีตอนขึ้น server บริษัท
- **ห้ามใส่ชื่อลูกค้าจริงในโค้ด/seed/test/comment** ใช้ `project_code` เท่านั้น
- Secret อยู่ backend เท่านั้น
- **ลำดับงาน: PM ก่อน → หยุดให้ข้าว review → QA → BA → UX/UI**

---

## Task list

### เฟส 0 — Scaffold
- **T1 — Scaffold repo** : monorepo `server/` + `web/`, docker-compose (postgres 16), `.env.example`, eslint/prettier, README
  🟢 เริ่มได้เลย
- **T2 — Prisma schema + migration + seed** : ทุก model ตาม `00-MASTER.md` §6 · seed `SectionRule` ตาม §5 · seed 3 โปรเจกต์ (code + guid เท่านั้น)
  🟢 เริ่มได้เลย (อิง T1)

### เฟส 1 — Data layer
- **T3 — Lark client** : axios instance ชี้ host SG, retry/backoff, logger ที่ไม่ log secret
  🟢 เริ่มได้เลย (อิง T1)
- **T4 — OAuth + refresh rotation** : CLI `lark:authorize`, `ensureAccessToken()`, DB lock, banner re-authorize
  🟡 ติดรอ **LARK_APP_SECRET จากข้าว** (เขียนโค้ดได้เลย แต่รันจริงไม่ได้จนกว่าจะได้ secret) (อิง T2, T3)
- **T5 — fetchAllTasks + fetchSections + users/batch** : pagination วนจน `has_more = false` + guard runaway
  🟢 เริ่มได้เลย (อิง T3) · **มี unit test เรื่อง pagination บังคับ**
- **T6 — Bucket engine** `domain/bucket.ts` : resolve section name → dept/bucket/weight ตาม rule ใน DB
  🟢 เริ่มได้เลย (อิง T2)
- **T7 — ETL runSync()** : extract → transform → load → soft-delete → resolve members → recompute metrics
  🟡 ติดรอ T4 (ต้องมี token จริงถึงจะทดสอบ end-to-end) (อิง T5, T6)
- **T8 — Snapshot** : `TaskStateSnapshot` + `DailyAggregate` upsert รายวัน
  🟢 เริ่มได้เลย (อิง T7)
- **T9 — Regression test `AUS_SILVER`** : 132 ใบ · QA 41/0/41/0 · progress = ค่าจาก weight ใน DB
  🟡 ติดรอ T4 (ต้องยิง Lark จริง) — แต่เขียน test ด้วย fixture ได้ก่อน

### เฟส 2 — PM Dashboard + Admin ← **แผนกแรก**
- **T10 — domain/progress.ts + status.ts** : weighted progress, auto status + เหตุผล, override + หมดอายุ 14 วัน
  🟡 ติดรอ **B4 ยืนยันตาราง weight** (ใช้ default ไปก่อนได้ แต่อย่า hardcode — อ่านจาก DB) (อิง T6)
- **T11 — API `/api/pm/*`** : portfolio, milestones, trend, attention, drill-down tasks
  🟢 เริ่มได้เลย (อิง T7, T10)
- **T12 — Auth layer** : `AuthProvider` interface + `DevAuth` + โครง `LarkSsoAuth` + role middleware
  🟢 เริ่มได้เลย (อิง T2)
- **T13 — หน้า Admin (5 แท็บ)** : projects · section rules (+banner section ที่ยังไม่ map) · members · attention items · สถานะระบบ + AuditLog
  🟢 เริ่มได้เลย (อิง T11, T12)
- **T14 — Component กลาง** : KpiCard, StatusBadge, DonutChart, StackedBar, TrendLine, FilterBar, DrillDownPanel, theme tokens
  🟢 เริ่มได้เลย (อิง T1)
- **T15 — GanttTimeline component** : target vs forecast, ◆ 4 แบบ, เส้นวันนี้, responsive, print/export PNG
  🟢 เริ่มได้เลย (อิง T14) — **งานหนักที่สุดของเฟสนี้ เผื่อเวลา**
- **T16 — หน้า PM Dashboard** : KPI 6 + BLOCK A–E + มุมมอง "ตาม PM" + drill-down
  🟡 ติดรอ **B7 รายชื่อโปรเจกต์ + PM เจ้าของ** (มุมมองตามโปรเจกต์ทำได้เลย · มุมมองตาม PM ติดรอ) (อิง T11, T15)
- **T17 — Cron + ปุ่ม Sync now + lock** : node-cron 08:00/17:00 + POST /api/sync/run
  🟢 เริ่มได้เลย (อิง T7, T8)
- **T18 — DoD เฟส PM** : เช็คตาม `02-PM-DASHBOARD.md` §12 + `grep` หาชื่อลูกค้าใน repo ต้องไม่เจอ
  🟡 ติดรอ T9–T17

> **🛑 หยุดที่นี่ ส่งข้าว review ก่อนไปต่อ**

### เฟส 3 — QA Dashboard
- **T19 — API `/api/qa/*`** : summary, workload (มี checksum), blockers (count+items ใน response เดียว), throughput, board
  🟡 ติดรอ **B2 (blocker มาจาก section ชื่ออะไร)** และ **B3 (ยืนยัน Ready for UAT / Ready for PROD)**
- **T20 — หน้า QA Dashboard** : layout ตาม `03-QA-DASHBOARD.md` §3 + แก้บั๊ก 4 ข้อ
  🟡 ติดรอ T19, B5 (tag แผนกให้สมาชิก), B6 (นโยบายการ์ดไม่มี assignee — มี default ให้แล้ว)
- **T21 — Regression QA** : `MYGOLD_BSEA` ต้องดึงได้ ~281 ใบ ไม่ใช่ 183
  🟡 ติดรอ T4

### เฟส 4 — Deploy
- **T22 — `LarkSsoAuth` + whitelist AppUser + deploy server บริษัท**
  🟡 ติดรอ **B8 (redirect URI + credential จาก IT)**

### เฟส 5–6 — BA / UX/UI
- **T23 — BA** : 🟡 ติดรอ **BA1** (ทีม BA ต้องสร้างบอร์ด `BA-SUPPORT` + กรอก custom field ก่อน)
- **T24 — UX/UI** : 🟡 ติดรอ **UX1** (ทีม UX/UI ต้องแตก section ก่อน) — ยกเว้น **On-time Delivery ทำได้เลยไม่ต้องรออะไร**

---

## สรุป scope

| | task | หมายเหตุ |
|---|---|---|
| **🟢 เริ่มได้ทันทีตอนนี้** | T1, T2, T3, T5, T6, T8, T11, T12, T13, T14, T15, T17 | **12 จาก 24 task = 50% ของงาน** |
| 🟡 ติดรอแค่ **LARK_APP_SECRET** | T4, T7, T9, T21 | ปลดได้ภายในวันเดียวถ้าข้าวส่ง secret |
| 🟡 ติดรอคำตอบของข้าว | T10 (B4), T16 (B7), T19 (B2,B3), T20 (B5,B6) | คำถามสั้น ๆ ทั้งนั้น |
| 🟡 ติดรอทีมอื่น | T22 (IT), T23 (ทีม BA), T24 (ทีม UX/UI) | ไม่บล็อก PM/QA |

**ครึ่งหนึ่งของระบบเริ่มได้เดี๋ยวนี้โดยไม่ต้องรอใคร** และ PM dashboard ซึ่งเป็นเป้าหมายหลัก ติดรอแค่ 2 เรื่อง (secret + ตาราง weight + รายชื่อ PM)

---

## ⛔ รวมสิ่งที่ข้าวต้องส่งกลับ (เรียงตามความเร่งด่วน)

| ลำดับ | เรื่อง | ปลด task |
|---|---|---|
| 1 | `LARK_APP_SECRET` (+ ยืนยันว่า app publish version แล้ว) | T4, T7, T9, T21 |
| 2 | ยืนยัน/แก้ **ตาราง weight ต่อ section** (`00-MASTER.md` §5) | T10 → progress ทุกโปรเจกต์ |
| 3 | **รายชื่อโปรเจกต์ทั้งหมด + PM เจ้าของ + target UAT/Go-Live** | T16 |
| 4 | **Screenshot section ของบอร์ดอื่นนอกจาก `AUS_SILVER`** | T19, T20 + ปิด B1/B2/B3 |
| 5 | นโยบายการ์ดที่ไม่มี assignee (default: แสดงเป็นกลุ่ม "ไม่ระบุ") | T20 |
| 6 | คุยกับหัวหน้า BA / UX/UI เรื่องเปลี่ยนบอร์ด | T23, T24 |
| 7 | Redirect URI ของ server บริษัท (คุยกับ IT) | T22 |
