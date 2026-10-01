# STATUS — ทำอะไรไปแล้ว · กำลังทำ · จะทำ

> อัพเดต 28 ก.ย. 2026 · **session ใหม่อ่าน [HANDOFF.md](HANDOFF.md) ก่อน** (สรุปทั้งหมด + ค้างอะไร)

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
- **หน้า Admin**: จัดการ project · กรอก target/actual date · status/progress override (reason บังคับ + หมดอายุ 14 วัน) · เพิ่มบอร์ดใหม่ · test-connection
- Progress = ถ่วงน้ำหนักตาม section · สถานะ auto (On Track/At Risk/Delayed) + เหตุผล
- AuditLog ทุก mutation

### ส่วนเพิ่มตามที่ข้าวขอ
- **CRUD Section Rules UI** + `recompute` (map section เอง → apply กับ task ทันที ไม่ยิง Lark) — แก้ปัญหา "เพิ่มบอร์ดแล้วข้อมูลมั่ว"
- **Budget + งวดการเงิน** (Project.budget + PaymentInstallment) — Admin จัดการ + แสดงในหน้า detail
- **Finance drill-down** — กดแถวโครงการ / งวดเลยกำหนด / แท่งกระแสเงินสด → drawer งวดการเงิน (อ่านอย่างเดียว · URL แชร์ได้)
- **as-of date** — ดูข้อมูลย้อนหลังจาก snapshot
- **stage filter** ในหน้า detail (dept/bucket/section)
- **หน้า Finance (C-level)** — portfolio summary · cash-flow 30/60/90 · revenue at risk · งวดค้างเก็บ
- **auto ทันที** — แก้ date/override → recompute status/attention เลย (ไม่ต้องรอ sync) · project DONE → attention หายเอง
- **WAITING** (รอเริ่ม — PM ตั้งเอง) · เอา Forecast ออก · Gantt = Target/Actual Go-Live (PR #5)

### Redesign UI ทั้ง Portal (PR #7 · 25 ก.ย.)
- ตาม Claude Design "Elegance PMO Design System v0.1" — sidebar กรมท่า · IBM Plex Sans Thai · การ์ดขาว · แดง = ปัญหาเท่านั้น · วันที่ พ.ศ. · เงิน `ลบ.`
- dialog แทน `prompt()` (override) · ยืนยันก่อนลบ (งวด/rule) · loading/empty/error ทุกการ์ด · มือถือใช้ได้
- frontend อย่างเดียว (API/ข้อมูลเหมือนเดิม) → [DESIGN-BRIEF.md](DESIGN-BRIEF.md) · รูป `docs/design/after/`

### บอร์ดแผนกบน Portal
- **YOK** `/yok` (Project Executive ของทีม PM อีกสาย) — อ่าน Google Sheet ฝั่ง server ด้วย service account · ⏳ รอข้าวตั้ง service account + เติมหัวคอลัมน์ → [YOK-BOARD.md](YOK-BOARD.md)
- **QA** `/qa/` (repo Dashboard_Tester) — ✅ เปิดบน server แล้ว · token Lark ของแอป QA เอง · **รายงาน Tester ตามช่วงวัน** (snapshot รายวัน) · DB ยังเป็น Supabase ของทีม tester
- **BA** `/ba/` (repo Dashboard_BA) — ✅ เปิดบน server แล้ว (25 ก.ย.) · DB `ba` แยก (user `ba_app`) · Lark user OAuth + เลือกบอร์ดใน `/ba/admin` · sync จ–ศ 08:00/17:00 → [BA-ONBOARDING.md](BA-ONBOARDING.md) · [BA-LARK-AUTH.md](BA-LARK-AUTH.md)

---

## 🔜 กำลังทำ — P0

| # | เรื่อง | สถานะ |
|---|---|---|
| P0-7 | **POC บน Vultr** | ✅ **ขึ้นจริง** `https://elegancedb.duckdns.org` (Vultr + DuckDNS + Caddy) · Lark SSO + whitelist ใช้งานได้ · sync 566 ใบ (3 บอร์ด) · ดึง image จาก GHCR + auto-deploy แล้ว → **[POC-DEPLOY.md](POC-DEPLOY.md)** |
| P0-1 | **Lark SSO + ผู้ใช้** | ✅ login ผ่าน · หน้า 🚫 สำหรับคนนอก whitelist · Admin แท็บ "ผู้ใช้" (เพิ่ม/role/ปิดใช้งาน + AuditLog) |
| P0-8 | **Portal หลายแผนก** | ✅ **ใช้งานจริง** — QA `/qa/` + BA `/ba/` เปิดบน server แล้ว (`COMPOSE_PROFILES=caddy,qa,ba`) · ค้างฝั่ง tester: ประตู `RELEASER` ใน CI · 2 instance เขียน Supabase เดียวกัน · `sync_meta` ค้าง "syncing" → **[BOARD-INTEGRATION.md](BOARD-INTEGRATION.md)** · **[HANDOFF.md](HANDOFF.md#4-ค้าง--รอ-เรียงตามความสำคัญ)** |
| P0-5 | **Auto-deploy (CI/CD)** | ✅ **ทำงานแล้วบน Vultr** (24 ก.ย.) — merge main → CI → GHCR → watchtower deploy เอง · เหลือข้าวเปิด branch protection ของ Dashboard_PM → **[CICD.md](CICD.md)** |
| P0-6 | **HTTPS staging (Cloudflare Tunnel)** | ✅ code พร้อม (ใช้ตอนย้ายเข้า domain บริษัท) → **[CLOUDFLARE-TUNNEL.md](CLOUDFLARE-TUNNEL.md)** · **[MIGRATION-POC-TO-STAGING.md](MIGRATION-POC-TO-STAGING.md)** |
| P0-4 | ~~server `203.150.48.37`~~ | ❌ เลิกใช้ — provider เปิด port ผิด เครื่อง down → ย้ายมา Vultr (P0-7) |

### 🔒 ต้องทำก่อนเปิดให้ผู้บริหาร / ทีมใช้จริง (ข้าวสั่ง note ไว้ 24 ก.ย.)
| # | เรื่อง | สถานะ |
|---|---|---|
| H-1 | **session เก็บใน Postgres** (แทน MemoryStore) | ✅ ขึ้น production แล้ว — ตาราง `session` + cookie 7 วัน rolling · restart/deploy แล้วไม่หลุด |
| H-2 | **backup DB รายวัน** — ทุก database (`pmo`, `ba`, …) | ✅ cron บน Vultr ทุกวัน 02:15 (`scripts/backup-db.sh`) · ยังอยู่ดิสก์เดียวกับ VM → ควร copy ออกนอกเครื่อง/เปิด Vultr backup → [MAINTAINING.md#backup](MAINTAINING.md#backup) |
| H-3 | **ปิด port บน Vultr** เหลือ 22/80/443 + SSH ใช้ key อย่างเดียว | 🟡 ufw เหลือ 22/80/443 แล้ว · **ปิด SSH password = TODO ข้าว (เลื่อนไว้)** → [MAINTAINING.md#h-3](MAINTAINING.md#h-3--ปิด-port--ssh-ใช้-key-อย่างเดียว) |
| — | **เชื่อม Lark ใหม่ผ่านหน้าเว็บ** | ✅ ขึ้น production แล้ว — ADMIN กดปุ่มในหน้าตั้งค่า ไม่ต้อง SSH / ไม่ต้องสลับ `AUTH_MODE=dev` |

### 📝 TODO ข้าว (ไม่เร่ง — เช็กทุกครั้งที่อ่านไฟล์นี้)
- [ ] **ปิด SSH password บน Vultr** — `ssh-copy-id root@<IP>` จากเครื่องตัวเอง → ลองเข้าด้วย key ให้ได้ → ค่อยปิด password → [MAINTAINING.md#h-3](MAINTAINING.md#h-3--ปิด-port--ssh-ใช้-key-อย่างเดียว)
- [ ] เปิด branch protection `main` ของ Dashboard_PM (Require PR + status check `test`)
- [ ] copy backup ออกนอกเครื่อง หรือเปิด Vultr Automatic Backups
- [x] ~~เปิดบอร์ด QA บน server~~ ✅ · [x] ~~เปิดบอร์ด BA~~ ✅
- [ ] ส่งผล `scripts/audit-tester-data.js` (ใน container `qa`) ให้ AI ตรวจข้อมูล QA
- [ ] บอร์ด BA: ติ๊กสิทธิ์ BA ให้ทีม · import snapshot เดิม (ถ้ายังไม่ทำ) · เช็ก sync อัตโนมัติ

→ POC: [POC-DEPLOY.md](POC-DEPLOY.md) · บอร์ดแผนก: [BOARD-INTEGRATION.md](BOARD-INTEGRATION.md) · migrate: [MIGRATION-POC-TO-STAGING.md](MIGRATION-POC-TO-STAGING.md) · auto-deploy: [CICD.md](CICD.md) · staging HTTPS: [CLOUDFLARE-TUNNEL.md](CLOUDFLARE-TUNNEL.md) · SSO: [NEXT-SSO.md](NEXT-SSO.md)

---

## ⬜ Roadmap ถัดไป (ข้าวเลือกลำดับ)

### C-level เพิ่มเติม
- ~~C-4 เชื่องวดค้างเก็บเข้า CEO Attention~~ ✅ autoKey `PAYMENT_OVERDUE` (เลยกำหนด ≥ 3 วัน · DECISION · เตือนต่อแม้โปรเจกต์ DONE) → กด "ดูงวด" เปิด drawer งวดในหน้า Finance
- C-5 Executive PDF / one-pager export

### PM มืออาชีพ
- Resource / workload ต่อคน (donut — รอ tag dept, B5)
- Velocity / throughput (เสร็จ/สัปดาห์ — มี snapshot แล้ว)
- Milestone hit-rate / slip trend
- มุมมอง "ตาม PM" (รอ pmUserId, B7)

### เฟสถัดไปตาม spec
- **QA dashboard** (`03-QA-DASHBOARD.md`) — bug 4 ข้อ, blocker parity, throughput
- ~~BA dashboard (`04`)~~ ✅ ทีม BA ทำแอปเองที่ `/ba/` · ทางเลือก: มุมมองย้อนดูสถานะ ณ วันที่จาก snapshot (เสนอข้าวแล้ว ยังไม่สั่ง)
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
| UX1 | ทีม UX เปลี่ยนบอร์ด | เฟส UXUI |

---

## Design principle (ห้ามละเมิด)
1. ตัวเลขทุกตัวต้องไล่กลับไปหาการ์ดใน Lark ได้ (drill-down + ลิงก์)
2. KPI กับ list ที่อธิบายมัน มาจาก query เดียวกัน
3. pagination วนจนจบเสมอ
4. ETL ล้ม → เก็บข้อมูลรอบก่อน ห้ามล้างตาราง
5. ไม่มีชื่อลูกค้าจริงในโค้ด/seed/test (ใช้ project_code)
6. ทุก mutation ลง AuditLog
