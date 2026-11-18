> 📌 **งานถัดไป** — เขียน 18 พ.ย. 2569 · ข้าวสั่งแล้ว **ยังไม่เริ่มลงมือ** — ย้ายมาทำในแชทใหม่
> แชทใหม่: อ่าน [HANDOFF.md](HANDOFF.md) ก่อน แล้วยืนยันแผนนี้กับข้าวสั้น ๆ ก่อนลงมือ
> ⚠️ ห้ามมีอีเมล/ชื่อลูกค้าจริงในโค้ด (repo public) · ภาพ PDF ที่ข้าวว่าไม่สวย = ไฟล์ที่ server ออกวันที่ 18 พ.ย. (หน้า 1 ว่างครึ่งล่าง · ลิงก์ footer เป็น `/pm` เปล่า)

# รายงานรายสัปดาห์ v2 — PDF ใหม่ + โน้ต 3 ช่อง + แยกงานเสร็จ + ดูย้อนหลัง (บอร์ด KHAW)

## Context
ข้าวดู PDF จาก production แล้วบอก "กาก" ต้องจัดใหม่ และขอเพิ่ม:
1. **สรุปภาพรวม** — กล่องพิมพ์ → ลง PDF
2. **ปัญหาและอุปสรรค** — กล่องพิมพ์ → ลง PDF
3. **งานนอก scope ที่ทำเพิ่มเติม** — กล่องพิมพ์ → ลง PDF
4. **โครงการ Done แยกเป็น section "เสร็จแล้ว"** และเอาออกจากหน้า dashboard หลัก · เรียงตามความเดือดร้อน **Delayed → At Risk → On Track → Done**
- ทั้งหมดเก็บเป็นรายสัปดาห์ · ดึง PDF ย้อนหลังได้ · เริ่มจากสัปดาห์นี้ ไม่ต้องย้อนหลัง

### ปัญหาใน PDF production (ดูภาพแล้ว)
- หน้า 1 **ว่างครึ่งล่าง** — บังคับตารางโครงการขึ้นหน้าใหม่ (`break-before: page`)
- **ลิงก์เสีย** — footer ขึ้น "ตรวจสอบได้ที่ /pm" เพราะ `PUBLIC_BASE_URL` บน server ว่าง
- footer ตัวเล็ก ฟอนต์ fallback อ่านยาก · ไม่มีลำดับความสำคัญ — ผู้บริหารต้องไล่อ่านเอง

---

## 1. โน้ตรายสัปดาห์ + PDF ย้อนหลัง

### DB (migration ใหม่)
```prisma
model WeeklyNote {            // ข้าวพิมพ์ — 1 แถวต่อสัปดาห์
  weekKey    String  @id      // ISO week กรุงเทพ เช่น 2026-W47 (ใช้ isoWeekBkk เดิมใน report/sendWeekly.js)
  summary    String  @default("")   // สรุปภาพรวม
  issues     String  @default("")   // ปัญหาและอุปสรรค
  outOfScope String  @default("")   // งานนอก scope ที่ทำเพิ่มเติม
  updatedBy  Int?
  updatedAt  DateTime @updatedAt
}
model WeeklyReportArchive {   // PDF ที่ "ปิดสัปดาห์" แล้ว — ดึงย้อนหลังได้ตรงตัว ไม่คำนวณใหม่
  weekKey     String   @id
  pdf         Bytes            // ~100–150 KB/สัปดาห์ · ปีละ ~7 MB
  dataAsOf    DateTime?
  generatedAt DateTime @default(now())
}
```

### ปิดสัปดาห์ = แยกจากการส่งเมล
- cron **ศุกร์ 17:30** ทำ 2 อย่าง: (1) สร้าง PDF รวมโน้ตสัปดาห์นั้น → เก็บลง `WeeklyReportArchive` **เสมอ** (2) ส่งเมล **ถ้าเปิดไว้** (ใช้ PDF ไฟล์เดียวกัน)
- ‼️ ประวัติต้องไม่ผูกกับเมล — ตอนนี้ SMTP ยังไม่ได้ตั้ง ถ้าผูกไว้ ประวัติจะว่างทุกสัปดาห์
- ปุ่ม **"ปิดสัปดาห์ตอนนี้"** (PM/ADMIN) เก็บฉบับสัปดาห์นี้ทันที (เผื่อปิดก่อนศุกร์) · กดซ้ำ = เขียนทับฉบับสัปดาห์นี้ + ลง AuditLog
- สัปดาห์ที่ปิดแล้ว → โน้ตแก้ไม่ได้ (ล็อก) PDF ย้อนหลังจะได้ตรงกับที่ส่งไปจริง

### API (`/api/pm/*` สิทธิ์บอร์ด PM)
- `GET /weekly-notes/current` → `{ weekKey, weekRange, note, closed }`
- `PUT /weekly-notes/:weekKey` (ADMIN/PM · เฉพาะสัปดาห์ที่ยังไม่ปิด · AuditLog)
- `GET /weekly-reports` → รายการสัปดาห์ที่ปิดแล้ว
- `GET /weekly-reports/:weekKey.pdf` → PDF ที่เก็บไว้
- `POST /weekly-reports/close` (ADMIN/PM) → ปิดสัปดาห์ปัจจุบัน

### UI หน้า KHAW
- การ์ด **"บันทึกประจำสัปดาห์ 16–20 พ.ย. 69"** — 3 textarea + ปุ่มบันทึก (บอกเวลาบันทึกล่าสุด · เตือนถ้าออกจากหน้าโดยยังไม่บันทึก) · VIEWER เห็นแบบอ่านอย่างเดียว
- ปุ่ม **"ดาวน์โหลด PDF"** = ฉบับสดของสัปดาห์นี้ (รวมโน้ตล่าสุด)
- การ์ด **"รายงานย้อนหลัง"** — รายการสัปดาห์ที่ปิดแล้ว กดโหลด PDF

## 2. แยกงานเสร็จ + เรียงตามความเดือดร้อน

ลำดับใหม่ใช้ทั้งหน้า dashboard และ PDF: **Delayed → At Risk → On Track → Waiting → Done**
(ข้าวไม่ได้ระบุ Waiting — วางหลัง On Track เพราะยังไม่เริ่ม ความเดือดร้อนต่ำกว่า) · ในสถานะเดียวกันเรียงตาม `slipDays` มากก่อน แล้ว `sortOrder` เดิม

หน้า `/pm`:
- Gantt + รายการโครงการหลัก **ไม่แสดง Done** · เรียงตามลำดับข้างบน
- section ใหม่ท้ายหน้า **"โครงการที่เสร็จแล้ว (N)"** พับเก็บได้
- KPI "โครงการทั้งหมด" + donut **ยังนับ Done** (เป็นภาพรวมพอร์ต — ไม่งั้นตัวเลขทั้งหมดลดลงเมื่องานจบ)
- ฟังก์ชันเรียงอยู่ `server/src/domain/portfolio.js` ที่เดียว (`sortByPain`) · API `/portfolio` คืนลำดับใหม่ → web กับ PDF ใช้ชุดเดียวกัน (§12.2)

## 3. PDF layout ใหม่ (A4)
**หน้า 1 — สิ่งที่ผู้บริหารอ่านก่อน**
1. หัว: Project Executive (KHAW) · สัปดาห์ · ข้อมูล ณ
2. **สรุปภาพรวม** (โน้ตข้าว) → **ปัญหาและอุปสรรค** → **งานนอก scope** — ช่องว่างแสดง "—" ไม่ซ่อนหัวข้อ
3. KPI แถวเดียว กระชับ (label อ่านง่ายขึ้น)
4. เรื่องรอผู้บริหารตัดสิน + Milestone ที่จะถึง

**หน้า 2+** — ตารางโครงการเรียงตามความเดือดร้อน (ไม่บังคับขึ้นหน้าใหม่ ไหลต่อจากหน้า 1) แล้วตาราง **"โครงการที่เสร็จแล้ว"** แยกท้าย
- footer ตัวใหญ่ขึ้น · ถ้า `PUBLIC_BASE_URL` ว่าง ไม่โชว์ลิงก์เสีย + log เตือน

## 4. ค้างจากรอบก่อน — บอร์ดหายจากเมนูช่วง deploy
web build ~40 วิ · server ~2 นาที (Chromium) → web ขึ้นก่อนทุกครั้ง → `boardGroups` ไม่มา → เมนูว่าง
แก้: `web/src/lib/boardGroups.ts` ฟังก์ชันเดียวให้ sidebar + หน้าแรก · ไม่มีข้อมูลกลุ่ม → แสดงบอร์ดครบใต้หัว "บอร์ด" แบบเดิม

## ไฟล์หลัก
แก้: `server/prisma/schema.prisma` + migration · `server/src/domain/portfolio.js` · `server/src/services/pmBoard.js` · `server/src/report/weeklyReport.js` · `server/src/report/sendWeekly.js` · `server/src/jobs/cron.js` · `server/src/api/routes/pm.js` · `web/src/pages/PM.tsx` · `web/src/components/GanttTimeline.tsx` (รับ list ที่กรองแล้ว — ไม่แก้ prop type) · `web/src/components/AppShell.tsx` · `web/src/pages/Landing.tsx` · `web/src/lib/api.ts` · `docs/WEEKLY-REPORT.md`
สร้าง: `server/src/services/weeklyNotes.js` · `web/src/components/WeeklyNotesCard.tsx` · `web/src/lib/boardGroups.ts` · tests

## Verification
- `test:ci`: `sortByPain` (ลำดับ + slip) · โน้ตแก้ได้เฉพาะสัปดาห์ที่ยังไม่ปิด · PDF มีโน้ต 3 ช่อง (escape HTML) · Done ไม่อยู่ตารางหลักแต่อยู่ section เสร็จแล้ว · ปิดสัปดาห์เก็บ PDF แม้ไม่ได้ตั้ง SMTP
- ใน browser: พิมพ์โน้ต → บันทึก → ดาวน์โหลด PDF เห็นข้อความ · Gantt ไม่มี Done · section เสร็จแล้วพับได้ · ปิดสัปดาห์ → โผล่ในรายงานย้อนหลัง โน้ตกลายเป็นอ่านอย่างเดียว
- ดู PDF เป็นภาพ: หน้า 1 ไม่ว่าง · ไทยถูก · footer อ่านได้
- จำลอง server เก่า (ไม่มี `boardGroups`) → เมนูยังมีบอร์ดครบ

## ข้าวทำได้เลยตอนนี้
ตั้ง `PUBLIC_BASE_URL=https://elegancedb.duckdns.org` ใน `server/.env.production` → `up -d server` (แก้ลิงก์เสียใน PDF)

**Git:** branch `feature/weekly-report-v2` → PR → merge เมื่อข้าวสั่ง
