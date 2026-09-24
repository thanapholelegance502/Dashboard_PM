# 02 — PM DASHBOARD · Project Portfolio (แผนกแรกที่ต้องสร้าง)

> อ่าน `00-MASTER.md` และ `01-DATA-LAYER.md` ก่อน
> ผู้อ่านหลัก: **CEO และ CFO** (ข้าว report ตรงกับสองคนนี้) · ผู้อ่านรอง: PM ด้วยกันเอง
> เกณฑ์ตัดสินว่าหน้านี้สำเร็จ: **CEO เปิดดู 30 วินาที แล้วรู้ว่าต้องตัดสินใจอะไรบ้าง**

---

## 1. สิ่งที่หน้านี้ต้องตอบ (เรียงตามลำดับความสำคัญ)

1. โปรเจกต์ไหน**จะไม่ทัน** และช้าไปกี่วัน
2. **อะไรบล็อกอยู่** ที่ต้องให้ผู้บริหารตัดสินใจ และต้องตัดสินใจ**ภายในวันไหน**
3. มี UAT / Go-Live อะไรใน 14 วันข้างหน้า
4. PM แต่ละคนถืออะไรอยู่ หนักไปไหม

ทุกบล็อกในหน้านี้ต้องตอบข้อใดข้อหนึ่งข้างบน ถ้าไม่ตอบ — ตัดออก

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Project Portfolio — Executive Summary              ข้อมูล ณ 18 ก.ย. 17:00 ⟳  │
│ On Time · On Quality · On Business Value                        [Sync now]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Filter] PM: ทั้งหมด ▾   สถานะ: ทั้งหมด ▾   โปรเจกต์: ทั้งหมด ▾   [รีเซ็ต]   │
│          มุมมอง:  ( ) ตามโปรเจกต์   (•) ตาม PM                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ KPI 1  KPI 2  KPI 3  KPI 4  KPI 5  KPI 6                       (§3)          │
├──────────────────────────────────────────────────────────────────────────────┤
│ BLOCK A — Project Timeline (Target vs Actual)                   (§6)         │
├───────────────────────────┬──────────────────────┬───────────────────────────┤
│ BLOCK B Milestones 14 วัน │ BLOCK C Status donut │ BLOCK D ต้องตัดสินใจ (§7) │
├───────────────────────────┴──────────────────────┴───────────────────────────┤
│ BLOCK E — ความคืบหน้าย้อนหลัง (trend)                            (§8)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

มุมมอง **"ตาม PM"** เปลี่ยน BLOCK A เป็นกลุ่มตาม PM แต่ละคน แต่ละกลุ่มมี donut สรุปของตัวเอง (ดู §6.3)

---

## 3. KPI Cards (6 ใบ)

| # | ชื่อ | สูตร | คลิกแล้วไปไหน |
|---|---|---|---|
| 1 | โปรเจกต์ทั้งหมด | `count(Project where isActive)` | ตารางโปรเจกต์ทั้งหมด |
| 2 | On Track | `count(status = ON_TRACK)` | กรอง BLOCK A |
| 3 | At Risk | `count(status = AT_RISK)` | กรอง BLOCK A |
| 4 | Delayed | `count(status = DELAYED)` | กรอง BLOCK A |
| 5 | UAT เดือนนี้ | `count(project where targetUat อยู่ในเดือนปัจจุบัน)` | BLOCK B |
| 6 | Go-Live เดือนนี้ | `count(project where targetGolive อยู่ในเดือนปัจจุบัน)` | BLOCK B |

- KPI 3, 4 แสดงเป็นสีเหลือง/แดงตาม `theme.ts`
- ใต้ตัวเลขแสดง % ของทั้งหมด (เช่น `2 (25%)`)
- **โปรเจกต์ที่ยังไม่กรอก targetGolive** → ไม่นับใน KPI 5/6 และต้องขึ้น badge เตือนใน BLOCK A ว่า "ยังไม่ได้ตั้งเป้า" (อย่าให้เงียบหาย)

---

## 4. Progress % — ถ่วงน้ำหนักตาม section (ล็อกแล้ว)

```
progressPct(project) = Σ(sectionWeight ของทุกการ์ดที่ยังไม่ถูกลบ) / (จำนวนการ์ดทั้งหมด × 100) × 100
```

```ts
// server/src/domain/progress.ts
export function computeProgress(tasks: Task[]): number {
  const live = tasks.filter(t => !t.isDeleted);
  if (live.length === 0) return 0;
  const sum = live.reduce((acc, t) => acc + t.sectionWeight, 0);
  return Math.round(sum / live.length);   // เพราะ weight เป็น 0-100 อยู่แล้ว
}
```

ตาราง weight อยู่ใน `SectionRule` (ดู `00-MASTER.md` §5) แก้จากหน้า Admin ได้ **⚠️ blocked-on B4 ยังรอข้าวยืนยันตัวเลข**

**พฤติกรรมที่ต้องอธิบายให้ผู้ใช้เข้าใจ (ใส่ tooltip ไว้):**
- การ์ดใหม่ที่เพิ่งเพิ่มเข้าบอร์ดจะ**ดึง % ลง** — นี่ถูกต้อง เพราะ scope โต งานที่เหลือมากขึ้นจริง
- การ์ดที่โดนเด้งกลับ (`Fail bug`, weight 60) จะดึง % ลงจาก 88 → 60 — ตั้งใจ

**Manual override:** PM แก้ `progressOverride` ได้จากหน้า Admin
- ถ้ามีค่า → แสดงค่านั้น + ไอคอน ✎ + tooltip `"PM ปรับเอง · ระบบคำนวณได้ 54% · โดย <ชื่อ> เมื่อ <วันที่>"`
- override **หมดอายุอัตโนมัติใน 14 วัน** แล้วกลับไปใช้ค่าคำนวณ (กัน override ค้างเป็นปีจนตัวเลขโกหก)

---

## 5. สถานะโปรเจกต์ — auto + PM override (ล็อกแล้ว)

> **แก้ 24 ก.ย. 2026 (ข้าวสั่ง):** ตัด forecast ทั้งหมด — milestone UAT/Go-Live มีแค่ **Target + Actual** · DELAYED = เลย target แล้วยังไม่ go-live · เพิ่มสถานะ **`WAITING`** (รอเริ่ม) ที่ **PM ตั้งผ่าน override เท่านั้น** · badge override **ไม่มีไอคอน 🔒** แล้ว (ดูที่มาผ่าน tooltip)

### 5.1 กติกา auto
ประเมินตามลำดับ เจอข้อไหนก่อนใช้ข้อนั้น:

```ts
// server/src/domain/status.ts
function computeAutoStatus(p: Project, m: ProjectMetrics, today: Date): Status {
  if (p.actualGolive) return 'DONE';

  // DELAYED
  if (p.targetGolive && today > p.targetGolive) return 'DELAYED';

  // AT_RISK
  if (m.blockedCount > 0) return 'AT_RISK';
  if (m.openCount > 0 && m.overdueCount / m.openCount > 0.10) return 'AT_RISK';
  if (p.targetGolive && daysUntil(p.targetGolive, today) <= 14 && m.progressPct < 80) return 'AT_RISK';

  return 'ON_TRACK';
}
```

| สถานะ | เงื่อนไข |
|---|---|
| `DONE` | มี `actualGolive` แล้ว |
| `DELAYED` | เลย `targetGolive` แล้วยังไม่ go-live |
| `AT_RISK` | ไม่ delayed แต่: มี blocker ≥ 1 **หรือ** overdue > 10% ของงานค้าง **หรือ** เหลือ ≤14 วันถึง target แต่ progress < 80% |
| `ON_TRACK` | นอกนั้น |
| `WAITING` | รอเริ่ม — **auto ไม่คืนค่านี้** · PM ตั้งผ่าน override เท่านั้น (กติกา override เดิม: reason บังคับ, AuditLog, หมดอายุ 14 วัน) |

**ต้องเก็บ "เหตุผลที่ระบบให้สถานะนี้"** เป็น string list แล้วแสดงเป็น tooltip เช่น
`"At Risk เพราะ: มีงานติดปัญหา 3 ใบ · งานเกินกำหนด 12% (5/41)"`
ห้ามแสดงสีเฉย ๆ โดยไม่บอกเหตุผล — CEO จะถามทันทีว่าทำไม

### 5.2 Override
- PM กดเปลี่ยนสถานะได้จากหน้า Admin หรือจากแถวใน BLOCK A
- **เหตุผลเป็น required field** (ขั้นต่ำ 10 ตัวอักษร) — ไม่กรอกไม่ให้บันทึก
- แสดงเป็น badge สีตาม override (ไม่มีไอคอน 🔒 — ตัดออก 24 ก.ย.) + tooltip `"PM ปรับเป็น On Track · เหตุผล: <...> · ระบบคำนวณได้ At Risk · <ชื่อ> 18 ก.ย."`
- ลง `AuditLog` ทุกครั้ง (`action = OVERRIDE`)
- **override หมดอายุ 14 วัน** เหมือน progress
- ถ้า auto status เปลี่ยนไปเป็นค่าที่แย่กว่า override หลัง override ถูกตั้ง → ขึ้นเตือน PM ในหน้า Admin ว่า "สถานะจริงแย่ลงแล้ว ยืนยัน override อีกครั้งไหม"

---

## 6. BLOCK A — Project Timeline (Target vs Actual)

นี่คือบล็อกที่สำคัญที่สุดของหน้า **ต้องเขียน component เอง** (Recharts ทำ gantt ไม่ได้)

### 6.1 โครงตาราง (ซ้าย) + timeline (ขวา)

| คอลัมน์ซ้าย | ที่มา |
|---|---|
| # | ลำดับ |
| Project | `displayName` (คลิก → drill-down §9) |
| PM | `Member.nickname` |
| Progress | bar + % (§4) |
| Start | `startDate` |
| Target Go-Live | `targetGolive` |
| Actual Go-Live | `actualGolive` — ช้ากว่า target แสดงแดง `+N` · ยังไม่ live แต่เลย target แสดงแดง `เลย N วัน` · อื่น ๆ `—` |
| Status | badge (§5) |

**Timeline (ขวา):** แกน X = สัปดาห์ ครอบคลุม `min(startDate)` ถึง `max(actualGolive ?? targetGolive) + 2 สัปดาห์`

| สัญลักษณ์ | ความหมาย |
|---|---|
| แถบอ่อน | ช่วงโปรเจกต์ (start → actual Go-Live หรือ target ถ้ายังไม่ live) |
| ◆ เขียวอ่อน | UAT (Target) |
| ◆ เขียวเข้ม | UAT (Actual) |
| ◆ น้ำเงินอ่อน | Go-Live (Target) |
| ◆ น้ำเงินเข้ม | Go-Live (Actual) |
| เส้นแดงแนวตั้ง | วันนี้ |

- hover ◆ → tooltip บอกชื่อ milestone + วันที่ + ต่างจาก target กี่วัน

### 6.2 Technical note สำหรับ Gantt
- ใช้ CSS Grid: 1 แถว = 1 โปรเจกต์, คอลัมน์ = สัปดาห์ → ตำแหน่ง ◆ คำนวณเป็น `%` ของความกว้าง
- responsive: ต่ำกว่า 1280px ให้ยุบ timeline เป็น scroll แนวนอน แต่ตารางซ้ายค้างไว้ (`position: sticky`)
- **ต้องพิมพ์ออกมาเป็น PDF/รูปได้** (CEO เอาไปแปะสไลด์) → เตรียม print stylesheet + ปุ่ม "Export PNG"

### 6.3 มุมมอง "ตาม PM"
จัดกลุ่มแถวตาม `Project.pmUserId` แต่ละกลุ่มมีหัวกลุ่ม:
```
👤 <ชื่อ PM>   N โปรเจกต์   [donut เล็ก: On Track x / At Risk y / Delayed z]
```
ใช้เพื่อดู workload ของ PM (บริษัทมี PM 2 คนรวมข้าว — ถ้ามีแค่ 2 กลุ่มก็ยังมีประโยชน์เรื่องความสมดุล)
⚠️ ต้องมี `pmUserId` ครบทุกโปรเจกต์ก่อน = **blocked-on B7**

---

## 7. BLOCK D — "ต้องตัดสินใจ / CEO Attention Required"

ตารางนี้คือเหตุผลที่ CEO จะเปิดหน้านี้ซ้ำ

| คอลัมน์ | ที่มา |
|---|---|
| Project | `AttentionItem.projectId` |
| เรื่องที่ต้องตัดสินใจ | `title` + `issueType` badge |
| ผลกระทบ | `impactText` (เช่น `Go-Live +7 วัน`) — สีแดงถ้ากระทบวันที่ |
| ต้องได้คำตอบภายใน | `neededBy` — แดงถ้าเลยแล้ว, เหลืองถ้าเหลือ ≤3 วัน |
| ผู้เสนอ | `createdBy` |

**สองแหล่ง:**
1. **MANUAL** — PM กรอกเองจากหน้า Admin (แหล่งหลัก งานตัดสินใจจริง ๆ ไม่มีทางอ่านจาก Lark ได้)
2. **AUTO** — ระบบ generate ให้ทุกรอบ sync (`source = AUTO`) เมื่อเข้าเงื่อนไข:

| เงื่อนไข | สร้าง item |
|---|---|
| โปรเจกต์เป็น `DELAYED` และยังไม่มี attention item เปิดอยู่ | `"โปรเจกต์ล่าช้า <N> วัน — ต้องตัดสินใจขยาย timeline หรือเพิ่มทรัพยากร"` |
| การ์ดใน bucket `BLOCKED` ค้าง > 3 วัน | `"งานติดปัญหาค้าง <N> ใบ เกิน 3 วัน"` |
| overdue > 20% ของงานค้าง | `"งานเกินกำหนด <N>/<M> ใบ"` |

- AUTO item ที่เงื่อนไขหายไปแล้ว → auto-resolve (ไม่ต้องให้คนมาปิด)
- MANUAL item ต้องให้คนกดปิดเอง
- เรียงตาม `neededBy` ใกล้สุดก่อน แล้วค่อยตาม impact

---

## 8. BLOCK E — Trend ย้อนหลัง

อ่านจาก `DailyAggregate` (ดู `01-DATA-LAYER.md` §5)

- เส้น: progress % ต่อโปรเจกต์ (เลือกได้สูงสุด 5 เส้น) — ราย**สัปดาห์** ใช้ค่าวันศุกร์
- **สัปดาห์แรก ๆ จะมีจุดเดียว** — นี่คือบั๊กข้อ 4 ของ Genspark ที่เราไม่ได้แก้ แต่**แก้วิธีสื่อสาร**:
  แสดงข้อความ `"เก็บข้อมูลมาแล้ว N สัปดาห์ · กราฟแนวโน้มจะสมบูรณ์เมื่อครบ 4 สัปดาห์"` แทนการโชว์กราฟเปล่า ๆ ที่ดูเหมือนพัง
- **เริ่มเก็บ snapshot ตั้งแต่วันแรกที่ deploy** ยิ่งช้ายิ่งได้เส้นสั้น

---

## 9. Drill-down (สำคัญ — แก้ปัญหา "ตัวเลขไม่ตรงแล้วไล่ไม่ได้")

คลิกอะไรก็ตามที่เป็นตัวเลข → panel เลื่อนออกมาจากขวา แสดง:
```
<ชื่อโปรเจกต์> · <เงื่อนไขที่กรองอยู่>          N ใบ
─────────────────────────────────────────────────
สรุปตามแผนก:  PM 3 · BA 2 · UXUI 0 · DEV 82 · QA 41   [แท็บเลือกได้]
สรุปตาม section: Ready for Test 41 · Dev-In Progress 70 ...
─────────────────────────────────────────────────
รายการการ์ด (ตาราง):
  ชื่อการ์ด | section | ผู้รับผิดชอบ | กำหนดส่ง | สถานะ | [เปิดใน Lark ↗]
```
ทุกแถวมีลิงก์กลับไปการ์ดจริงใน Lark — **ข้อนี้ห้ามตัด** เป็นสิ่งที่ทำให้คนเชื่อตัวเลข

---

## 10. หน้า Admin (ต้องทำพร้อม PM dashboard — ไม่ใช่ทำทีหลัง)

### แท็บ 1 — โปรเจกต์
ตาราง CRUD: `projectCode` · `displayName` · `larkTasklistGuid` · `pmUserId` · `startDate` · target/actual UAT & Go-Live · `isActive` · `sortOrder`
- ปุ่ม "ทดสอบการเชื่อมต่อ" ต่อแถว → ยิง Lark ดูว่าอ่าน tasklist นี้ได้ไหม + คืนจำนวนการ์ด (ตรวจว่าข้าวเป็นสมาชิกบอร์ดหรือยัง)
- ช่อง status override + reason
- ช่อง progress override

### แท็บ 2 — Section Rules
ตาราง CRUD `SectionRule` (§5 ของ MASTER) + **banner แดงบนสุด**:
```
⚠️ พบ 3 section ที่ยังไม่ได้ map (มีการ์ดค้างอยู่ 27 ใบ):
   "Waiting for PM" (12) · "Design Review" (9) · "Hold" (6)      [map เลย]
```
นี่คือกลไกที่ทำให้ระบบไม่เงียบเวลาทีมสร้าง section ใหม่

### แท็บ 3 — สมาชิก
ตาราง `Member` ที่ ETL ดึงมาให้ + ให้ข้าว tag `deptCode` และ `nickname` · toggle `isActive`

### แท็บ 4 — Attention Items
CRUD `AttentionItem` (ดู §7)

### แท็บ 5 — สถานะระบบ
- ประวัติ `SyncRun` 30 รายการล่าสุด: เวลา, trigger, สถานะ, จำนวนการ์ด, จำนวนหน้า, error
- สถานะ Lark token: หมดอายุเมื่อไหร่ · ปุ่ม "Re-authorize"
- ปุ่ม `Sync now` + ปุ่ม `สร้าง snapshot วันนี้`

---

## 11. API

```
GET  /api/pm/portfolio?pm=&status=&projectCode=
     → { asOf, lastSyncAt, kpis{...}, projects[ { code, displayName, pm, progressPct,
         progressSource: 'AUTO'|'OVERRIDE', status, statusSource, statusReasons[],
         startDate, targetUat, actualUat, targetGolive, actualGolive, slipDays,
         counts{ open, done, blocked, overdue, total } } ] }

GET  /api/pm/milestones?days=14
GET  /api/pm/trend?projectCodes=&weeks=12
GET  /api/pm/attention?status=OPEN
GET  /api/pm/projects/:code/tasks?dept=&bucket=&overdue=    ← drill-down
GET  /api/meta/projects | /api/meta/members | /api/meta/sections
GET  /api/sync/status
POST /api/sync/run                                          (ADMIN|PM)
POST /api/sync/snapshot                                     (ADMIN)
CRUD /api/admin/projects | /section-rules | /members | /attention-items   (ADMIN|PM)
POST /api/admin/projects/:code/status-override  { status, reason }        (ADMIN|PM)
```

ทุก response ต้องมี `asOf` และ `lastSyncAt` — frontend เอาไปแสดงมุมขวาบนทุกหน้า

---

## 12. Definition of Done ของเฟส PM

- [ ] `npm run dev` ขึ้นครบ (postgres docker + server + web)
- [ ] `npm run sync` ดึง `AUS_SILVER` ได้ **132 ใบ** ตรง regression (`00-MASTER.md` §10)
- [ ] progress ของ `AUS_SILVER` = ค่าที่คำนวณจากตาราง weight ใน DB (default = 54%)
- [ ] หน้า PM แสดง KPI 6 ใบ + Gantt + milestone + donut + attention ครบ
- [ ] คลิกทุกตัวเลขแล้ว drill-down ได้ และลิงก์กลับ Lark ได้
- [ ] หน้า Admin แก้ project / section rule / member / attention ได้ และลง AuditLog
- [ ] status override บังคับกรอกเหตุผล + แสดง badge + tooltip
- [ ] cron 08:00/17:00 ทำงาน + ปุ่ม Sync now มี lock กันกดซ้อน
- [ ] section ที่ไม่ได้ map ขึ้น banner เตือน ไม่เงียบ
- [ ] ไม่มีชื่อลูกค้าใน repo (grep แล้วต้องไม่เจอ)
- [ ] unit test ของ `bucket.ts`, `progress.ts`, `status.ts` ผ่าน

**หยุดที่นี่ ให้ข้าว review ก่อน แล้วค่อยไปเฟส QA**
