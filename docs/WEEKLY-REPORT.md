# อีเมลสรุปรายสัปดาห์ + PDF — บอร์ด Project Executive (KHAW)

> ปุ่ม **"ดาวน์โหลด PDF"** ในหน้า `/pm` + อีเมลอัตโนมัติ **ทุกศุกร์ 17:30** แนบ PDF ไฟล์เดียวกัน
> ตัวเลขมาจาก service เดียวกับหน้า `/pm` (`server/src/services/pmBoard.js`) — ไม่มีทางต่างจากบนจอ (MASTER §12.2)

---

## 0. รายงาน v2 — โน้ต 3 ช่อง + ปิดสัปดาห์ + ดูย้อนหลัง

**โน้ตรายสัปดาห์ (PM/ADMIN พิมพ์)** — การ์ด "บันทึกประจำสัปดาห์" ในหน้า `/pm` มี 3 ช่อง: **สรุปภาพรวม · ปัญหาและอุปสรรค · งานนอก scope ที่ทำเพิ่มเติม** → ขึ้น **หน้า 1** ของ PDF (ช่องว่าง = "—") · VIEWER เห็นแบบอ่านอย่างเดียว · เก็บ 1 แถว/ISO week (`WeeklyNote.weekKey`)

**ปิดสัปดาห์ = เก็บ PDF ย้อนหลัง** — cron ศุกร์ 17:30 (+ ปุ่ม "ปิดสัปดาห์ตอนนี้") เก็บ PDF ลง `WeeklyReportArchive` **เสมอ แม้ยังไม่ตั้ง SMTP** (ประวัติไม่ผูกกับการส่งเมล) · สัปดาห์ที่ปิดแล้ว **โน้ตล็อก แก้ไม่ได้** · กดปิดซ้ำ = เขียนทับฉบับสัปดาห์นั้น + ลง AuditLog
- การ์ด "รายงานย้อนหลัง" ในหน้า `/pm` → กดโหลด PDF ของสัปดาห์ที่ปิดแล้ว
- ลง cron ปิดสัปดาห์เมื่อ `NODE_ENV=production` (`isWeeklyArchiveEnabled`) · ส่งเมลเมื่อ SMTP ครบ (`isWeeklyReportEnabled`) — แยกกัน

**ลำดับโครงการ** — ทั้งหน้า `/pm` และ PDF เรียงตามความเดือดร้อน **Delayed → At Risk → On Track → Waiting → Done** (`sortByPain` ใน `domain/portfolio.js` ชุดเดียว) · **งาน Done แยก section "เสร็จแล้ว"** ออกจาก timeline/ตารางหลัก · KPI + donut ยังนับ Done (ภาพรวมพอร์ต)

**ลิงก์ footer** — ถ้า `PUBLIC_BASE_URL` ว่าง PDF ไม่โชว์ลิงก์เสีย (เลี่ยง "ตรวจสอบได้ที่ /pm") + log เตือน → ตั้ง `PUBLIC_BASE_URL` บน server ให้ลิงก์กลับมา

**API** (`/api/pm/*` สิทธิ์บอร์ด PM · mutation = ADMIN/PM): `GET weekly-notes/current` · `PUT weekly-notes/:weekKey` · `GET weekly-reports` · `GET weekly-reports/:weekKey.pdf` · `POST weekly-reports/close`

---

## 1. ในรายงานมีอะไร (A4 แนวตั้ง)

หน้า 1: **โน้ต 3 ช่อง** · KPI 7 ใบ · CEO Attention · สถานะโครงการ (donut) · Milestone ที่จะถึง
หน้า 2+: ตารางโครงการ (เรียงตามความเดือดร้อน · ไม่รวม Done) → ตาราง **"โครงการที่เสร็จแล้ว"** แยกท้าย
ทุกหน้ามีลิงก์กลับ dashboard จริง (§12.1) · ไม่ใส่ Gantt/trend (A4 แคบเกินอ่าน)

**ถ้า sync 17:00 วันศุกร์ล้ม → ยังส่ง** แต่ขึ้นแถบแดง "ข้อมูล ณ <เวลา sync ล่าสุดที่สำเร็จ>" ทั้งในเมลและ PDF
(กดปุ่มเองระหว่างวัน ใช้เกณฑ์ 24 ชม. เดียวกับ pill บนจอ)

## 2. ตั้งค่าบน server (ทำครั้งเดียว — คนที่ถือบัญชีเมลทำเองเท่านั้น)

### สร้าง App Password (Google Workspace)
1. `myaccount.google.com` → **Security** → เปิด **2-Step Verification** (ถ้ายังไม่เปิด)
2. Security → **App passwords** → ตั้งชื่อ `PMO Portal` → ได้รหัส 16 ตัว (ใส่แบบไม่เว้นวรรค)
3. ⚠️ ไม่เห็นเมนู App passwords = แอดมิน Workspace ของบริษัทปิดไว้ → ขอเปิด

> รหัสนี้ใช้ส่งเมลแทนเรา ไม่ใช่รหัส login · ถอนได้ที่หน้าเดียวกันโดยไม่กระทบรหัสหลัก

### ใส่ค่าใน `server/.env.production` (ตัวอย่างค่าปลอมใน `server/.env.production.example`)
```dotenv
PUBLIC_BASE_URL=https://<domain ของ portal>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<อีเมลผู้ส่ง>
SMTP_PASS=<App Password 16 ตัว>
MAIL_FROM=<อีเมลผู้ส่ง>
MAIL_ALLOWED_DOMAIN=<โดเมนบริษัท>
WEEKLY_REPORT_TO=<คน1>,<คน2>,<คน3>
WEEKLY_REPORT_ENABLED=false
```
```bash
chmod 600 server/.env.production
docker compose -f docker-compose.prod.yml up -d server   # ต้อง up -d (restart ไม่อ่าน env ใหม่)
```

‼️ **repo นี้ public — อีเมลและรหัสอยู่ใน `.env.production` บน server เท่านั้น** ห้ามขึ้น git / แชท / docs

### ทดสอบก่อนเปิดจริง
```bash
DC="docker compose -f docker-compose.prod.yml"
$DC exec server npm run report:weekly -- --verify-smtp      # login SMTP ได้ไหม (ไม่ส่งอะไร)
```
หน้าตั้งค่า → แท็บ **อีเมลสรุปรายสัปดาห์** → **ส่งทดสอบถึงตัวผม** → เช็คกล่องจดหมาย: ได้เมล + PDF อ่านไทยถูก + ลิงก์เปิดได้

### เปิดส่งจริง
`WEEKLY_REPORT_ENABLED=true` → `$DC up -d server` → log ต้องขึ้น
```
[cron] weekly report: "30 17 * * 5" (Asia/Bangkok)
```

### ⚠️ ผู้รับต้องมีบัญชีใน Portal
ลิงก์ในเมลเปิดหน้า `/pm` ซึ่งต้อง login (Lark SSO + whitelist) → เพิ่มผู้รับทั้ง 3 คนในหน้าตั้งค่า → **ผู้ใช้** และติ๊กบอร์ด **Project Executive (KHAW)** ไม่งั้นกดลิงก์แล้วเจอหน้า login/ไม่มีสิทธิ์

## 3. กันส่งพลาด (ออกแบบไว้แล้ว)

| ทาง | ส่งถึงใคร |
|---|---|
| cron ศุกร์ 17:30 | ผู้รับจริง — **เฉพาะ `NODE_ENV=production` + `WEEKLY_REPORT_ENABLED=true`** |
| ปุ่ม "ส่งทดสอบถึงตัวผม" | อีเมลของ**คนที่กด**เท่านั้น · กดได้นาทีละครั้ง · ใช้ไม่ได้ในโหมด `AUTH_MODE=dev` |
| `npm run report:weekly -- --out r.pdf` | ไม่ส่ง — สร้างไฟล์อย่างเดียว (ค่าเริ่มต้น) |
| `npm run report:weekly -- --to me@<domain>` | อีเมลเดียวที่ระบุ |
| `npm run report:weekly -- --resend-scheduled --yes` | ผู้รับจริง (เช่นส่งซ้ำหลังศุกร์ที่ล้ม) · production เท่านั้น · สัปดาห์ที่ส่งแล้วจะข้าม (เพิ่ม `--force` ถ้าตั้งใจส่งซ้ำ) |

- ผู้รับทุกคนต้องอยู่ `MAIL_ALLOWED_DOMAIN` — พิมพ์ผิดเป็นโดเมนนอก = ไม่ส่งทั้งชุด
- **1 สัปดาห์ส่งได้ครั้งเดียว** (เช็คจาก AuditLog `entity=WeeklyReport`) — container restart ช่วง 17:30 ไม่ทำให้ส่งซ้ำ
- **`WEEKLY_REPORT_ENABLED=true` เปิดได้ stack เดียว** — ย้าย staging แล้วอย่าเปิดทั้งสองที่ (กันเช็คซ้ำคนละ DB)
- ทุกครั้งที่ส่ง (สำเร็จ/ล้ม) ลง AuditLog — เก็บจำนวน + โดเมนผู้รับ **ไม่เก็บอีเมล**

## 4. แก้ปัญหา

| อาการ | สาเหตุ / ทางแก้ |
|---|---|
| `535` / `EAUTH` | App Password ผิด หรือถูกถอน → สร้างใหม่ · ใส่แบบไม่เว้นวรรค |
| ปุ่มส่งทดสอบกดไม่ได้ | ยังไม่ได้ตั้ง SMTP ครบ (ดูการ์ดในแท็บ) |
| ไม่ส่งวันศุกร์ | log `[cron weekly-report]` · การ์ดในหน้าตั้งค่า · node-cron ไม่ตามส่งย้อนหลังถ้า container restart ตรง 17:30 → ใช้ `--resend-scheduled --yes` |
| PDF ขึ้น 503 "กำลังสร้างรายงานอื่นอยู่" | สร้างได้ทีละไฟล์ (คิว 2) กัน RAM เต็ม → รอแล้วกดใหม่ |
| ภาษาไทยในท้ายหน้า PDF เป็นสี่เหลี่ยม | image ไม่มี `fonts-thai-tlwg` → build ใหม่จาก `server/Dockerfile` |
| เมลออกในนามผู้ถือบัญชี | ตั้งใจ (ใช้เมลส่วนตัว) — ถ้าคนนั้นเปลี่ยนรหัส Google / ถอน App Password / ลาออก รายงานหยุดส่ง · ระยะยาวย้ายไปบัญชีกลาง แค่เปลี่ยน env |

**ปิดฉุกเฉิน:** `WEEKLY_REPORT_ENABLED=false` → `$DC up -d server`

## 5. RAM (VPS 1–2 GB)
Chromium เปิดเฉพาะตอนสร้าง PDF (~2–5 วินาที · ~150–250 MB) แล้วปิดทันที · ทีละ 1 ไฟล์ · ไม่ค้างใน memory
เช็คก่อน/หลังเปิดใช้: `free -m` · `docker stats --no-stream`
