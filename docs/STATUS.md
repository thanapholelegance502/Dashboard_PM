# STATUS — ทำอะไรไปแล้ว · กำลังทำ · จะทำ

> อัพเดต 21 ก.ย. 2026

---

## ✅ เสร็จแล้ว

### P1 — Data Layer (Lark ETL)
- Lark OAuth (user_access_token ในนามข้าว) + refresh token rotation + DB lock
- ETL: ดึง section + task ต่อ section (pagination วนจน `has_more=false`) → map → upsert → soft-delete
- Snapshot รายวัน (`TaskStateSnapshot` + `DailyAggregate`) สำหรับ trend/as-of
- Cron 08:00 / 17:00 (Asia/Bangkok) + ปุ่ม Sync now (มี lock กันกดซ้อน)
- 6 บอร์ด: AUS_SILVER · MYGOLD_BSEA · LKN · CPC_YSG · TCG_CL · AUS_POS (~772 การ์ด)
- 56 unit + integration tests

### P2 — PM Dashboard + Admin
- **หน้า PM**: KPI 6 · Gantt (เขียนเอง) · donut สถานะ (+ legend) · milestones 14 วัน · CEO Attention (auto) · trend · drill-down (คลิกทุกตัวเลข + ลิงก์กลับ Lark)
- **หน้า Admin**: จัดการ project · กรอก target/forecast date · status/progress override (reason บังคับ + หมดอายุ 14 วัน) · เพิ่มบอร์ดใหม่ · test-connection
- Progress = ถ่วงน้ำหนักตาม section · สถานะ auto (On Track/At Risk/Delayed) + เหตุผล
- AuditLog ทุก mutation

### ส่วนเพิ่มตามที่ข้าวขอ
- **CRUD Section Rules UI** + `recompute` (map section เอง → apply กับ task ทันที ไม่ยิง Lark) — แก้ปัญหา "เพิ่มบอร์ดแล้วข้อมูลมั่ว"
- **Budget + งวดการเงิน** (Project.budget + PaymentInstallment) — Admin จัดการ + แสดงในหน้า detail
- **as-of date** — ดูข้อมูลย้อนหลังจาก snapshot
- **stage filter** ในหน้า detail (dept/bucket/section)
- **หน้า Finance (C-level)** — portfolio summary · cash-flow 30/60/90 · revenue at risk · งวดค้างเก็บ
- **auto ทันที** — แก้ date/override → recompute status/attention เลย (ไม่ต้องรอ sync) · project DONE → attention หายเอง

---

## 🔜 กำลังทำ — P0

| # | เรื่อง | สถานะ |
|---|---|---|
| P0-4 | **Deploy cloud** | ✅ **deploy แล้ว** บน `203.150.48.37` (Ubuntu+Docker) — container ครบ, authorize+sync 561 ใบ, nginx 200 · 🔴 ติด provider เปิด port 80/443/22 external (portal ไม่มี firewall UI) |
| P0-1 | **Lark SSO + HTTPS** | 🎯 **งานถัดไป** — code พร้อม, รอ domain+443+config → ดู **[NEXT-SSO.md](NEXT-SSO.md)** |

→ deploy: [DEPLOY.md](DEPLOY.md) · SSO: [NEXT-SSO.md](NEXT-SSO.md)

---

## ⬜ Roadmap ถัดไป (ข้าวเลือกลำดับ)

### C-level เพิ่มเติม
- C-4 เชื่องวดค้างเก็บเข้า CEO Attention (ตอนนี้แสดงแค่หน้า Finance)
- C-5 Executive PDF / one-pager export

### PM มืออาชีพ
- Resource / workload ต่อคน (donut — รอ tag dept, B5)
- Velocity / throughput (เสร็จ/สัปดาห์ — มี snapshot แล้ว)
- Milestone hit-rate / slip trend
- มุมมอง "ตาม PM" (รอ pmUserId, B7)

### เฟสถัดไปตาม spec
- **QA dashboard** (`03-QA-DASHBOARD.md`) — bug 4 ข้อ, blocker parity, throughput
- BA dashboard (`04`) — รอทีม BA สร้างบอร์ด BA-SUPPORT (BA1)
- UX/UI dashboard (`05`) — รอทีม UX แตก section (UX1)

### completeness
- Admin แท็บ members (tag dept) · attention CRUD · SyncRun log
- Gantt Export PNG

---

## ⛔ Blocked-on (รอข้าว/ทีม/IT ปลด)

| # | ติดอะไร | กระทบ |
|---|---|---|
| B4 | ยืนยัน weight ต่อ section (§5) — บางตัวยังเดา | progress ทุกบอร์ด |
| B5 | tag dept ให้ member | donut workload |
| B7 | PM เจ้าของแต่ละ project | มุมมองตาม PM |
| B8 | Lark SSO redirect URI + credential | deploy + SSO |
| BA1 / UX1 | ทีม BA/UX เปลี่ยนบอร์ด | เฟส BA / UXUI |

---

## Design principle (ห้ามละเมิด)
1. ตัวเลขทุกตัวต้องไล่กลับไปหาการ์ดใน Lark ได้ (drill-down + ลิงก์)
2. KPI กับ list ที่อธิบายมัน มาจาก query เดียวกัน
3. pagination วนจนจบเสมอ
4. ETL ล้ม → เก็บข้อมูลรอบก่อน ห้ามล้างตาราง
5. ไม่มีชื่อลูกค้าจริงในโค้ด/seed/test (ใช้ project_code)
6. ทุก mutation ลง AuditLog
