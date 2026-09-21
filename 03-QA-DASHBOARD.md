# 03 — QA / TESTER DASHBOARD

> อ่าน `00-MASTER.md` ก่อน · ไฟล์นี้แทนที่ `qa_dashboard_rebuild_spec.md` ฉบับเดิมทั้งหมด
> ผู้อ่าน: QA Lead, PM, CEO · ทีม tester 4 คน

---

## 1. Bucket ของแผนก QA

จาก `SectionRule` ที่ `deptCode = 'QA'` (ดู `00-MASTER.md` §5)

| section | bucket | นับเป็น |
|---|---|---|
| Ready for Test | BACKLOG | ค้าง / รอ tester |
| Testing | IN_PROGRESS | ค้าง |
| Ready for UAT ⚠️B3 | WAITING | ค้าง |
| Staging UAT | WAITING | ค้าง |
| UAT | DONE | เสร็จ (มุม tester) |
| Ready for PROD ⚠️B3 | DONE | เสร็จ |
| PROD | DONE | เสร็จ |
| DONE | DONE | เสร็จ |
| Fail bug | DONE | เสร็จ *(tester เทสจบ ส่งกลับ dev รอโยกสprint หน้า)* |
| ชื่อมีคำว่า "Block" | BLOCKED | อุปสรรค |
| section ของแผนกอื่น | — | **ไม่นับ** (นอก tester scope) |

```
ค้าง    = BACKLOG + IN_PROGRESS + WAITING
เสร็จ   = DONE
Active  = ค้าง           ← ล็อกแล้ว ไม่รวมเสร็จ (แก้บั๊กเดิม)
blocker = BLOCKED
```

---

## 2. 🐞 บั๊ก 4 ข้อของ Genspark และวิธีแก้ในระบบใหม่

| # | บั๊ก | ราก | แก้ยังไง |
|---|---|---|---|
| 1 | KPI blocker = 7 แต่ list ขึ้น "ไม่มีอุปสรรค 🎉" | ตัวนับกับ list มาจากคนละ query | **บังคับใช้ query เดียวกัน** — `GET /api/qa/blockers` คืนทั้ง `count` และ `items` ใน response เดียว frontend ห้ามนับเอง |
| 2 | Workload donut โชว์ tester คนเดียว 100% ทั้งที่มีงานในขอบเขต 146 ใบ | การ์ดของอีกบอร์ด ~105 ใบไม่มี assignee เลย → หายจาก donut เงียบ ๆ | **ต้องมีกลุ่ม "ไม่ระบุผู้รับผิดชอบ"** ใน donut เสมอ + ป้ายเตือน `"N ใบยังไม่มีผู้รับผิดชอบ"` พร้อมลิงก์ไปดูรายการ · donut นับเฉพาะ **งานค้าง** (bucket ≠ DONE) · ⚠️ blocked-on B6 ให้ข้าวเลือกนโยบายสุดท้าย แต่ **default = แสดงเป็นกลุ่ม "ไม่ระบุ" ห้ามซ่อน** |
| 3 | นิยาม Active กำกวม (เสร็จ+ค้าง) | ตั้งชื่อผิด | Active = ค้างอย่างเดียว · ถ้าอยากได้ตัวเลขรวมให้ใช้ชื่อ `"งานในขอบเขต tester ทั้งหมด"` แยกต่างหาก |
| 4 | Throughput มีจุดเดียว | ไม่มีประวัติ | เก็บ `DailyAggregate` ตั้งแต่วันแรก + แสดงข้อความ `"เก็บมาแล้ว N สัปดาห์"` แทนกราฟเปล่า |

---

## 3. Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ QA Weekly Dashboard · QA/TESTER TEAM       ข้อมูล ณ 18 ก.ย. 17:00 ⟳    │
├────────────────────────────────────────────────────────────────────────┤
│ [Filter] สัปดาห์ ▾  โปรเจกต์ ▾  Tester ▾  [รีเซ็ต]   badge: W38        │
├────────────────────────────────────────────────────────────────────────┤
│ KPI: งานเสร็จสัปดาห์นี้ · งานค้างรวม · Active · โปรเจกต์ที่เคลื่อนไหว   │
│      · อุปสรรคเปิดค้าง                                                  │
├──────────────────────────────┬─────────────────────────────────────────┤
│ Throughput (line รายสัปดาห์) │ Workload ต่อ Tester (donut) §4          │
├──────────────────────────────┴─────────────────────────────────────────┤
│ สถานะงานต่อโปรเจกต์ (horizontal stacked bar)                            │
├────────────────────────────────────────────────────────────────────────┤
│ Project Board (ตาราง) §5                                                │
├────────────────────────────────────────────────────────────────────────┤
│ อุปสรรคที่เปิดอยู่ (list — query เดียวกับ KPI) §2.1                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Workload ต่อ Tester — กติกาที่แก้บั๊กข้อ 2

```ts
// จัดกลุ่มการ์ดใน QA scope (bucket ≠ DONE) ตาม assignee
สำหรับการ์ดที่มี assignee หลายคน → นับให้ทุกคน แต่แสดงหมายเหตุ "มีงานที่แชร์กัน N ใบ"
assignee ที่ deptCode ≠ 'QA'      → กลุ่ม "นอกทีม QA"    (แสดง ห้ามซ่อน)
ไม่มี assignee                     → กลุ่ม "ไม่ระบุผู้รับผิดชอบ" (แสดง ห้ามซ่อน)
```

ใต้ donut ต้องมีบรรทัดตรวจยอดเสมอ:
```
งานค้างรวม 76 ใบ = ในทีม QA 41 · นอกทีม QA 0 · ไม่ระบุผู้รับผิดชอบ 35     ✓ ยอดตรง
```
ถ้ายอดไม่ตรง → ขึ้นแถบแดง `"ยอดไม่ตรง ต่าง N ใบ"` **ห้ามแสดงกราฟที่ยอดไม่ครบโดยไม่บอก**

**flag workload หนัก:** tester ที่ถืองานค้าง > 1.5 × ค่าเฉลี่ยของทีม → badge 🔥

ทีม tester ปัจจุบัน 4 คน — ให้ข้าว tag `deptCode = 'QA'` ในหน้า Admin (blocked-on B5)
ไม่ hardcode รายชื่อในโค้ด · เพิ่ม/ลดคนทำผ่านหน้า Admin

---

## 5. Project Board (ตาราง)

| โปรเจกต์ | ทั้งหมด (QA scope) | เสร็จ | ค้าง | เลยกำหนด | อุปสรรค | % เสร็จ | สถานะ |
|---|---|---|---|---|---|---|---|

- `% เสร็จ = เสร็จ / (เสร็จ + ค้าง)`
- สถานะ: `ปกติ` / `เสี่ยง` (มี blocker หรือ overdue > 10%)
- ทุกตัวเลขคลิกได้ → drill-down เหมือน `02-PM-DASHBOARD.md` §9

**ค่าที่เคยเห็นบน Genspark (W38) ใช้เทียบได้:**
```
รวม: เสร็จ 70 · ค้าง 76 · โปรเจกต์ 2 · blocker 7
AUS_SILVER  : ค้าง 41 · เสร็จ 0  · 0%     ← verify แล้ว 100% ใช้เป็น regression
MYGOLD_BSEA : ค้าง 35 · เสร็จ 70 · 67%    ← ยังไม่ verify section เอง (blocked-on B1)
```

---

## 6. "งานเสร็จสัปดาห์นี้" — snapshot (ล็อกแล้ว)

```
เฟส 1 (snapshot น้อยกว่า 2 สัปดาห์):
    = count(bucket = DONE) ณ snapshot ล่าสุดของสัปดาห์นั้น
      แสดงป้าย "ยอดสะสม" กำกับไว้ให้ชัด

เฟส 2 (มี snapshot ≥ 2 สัปดาห์ — ระบบสลับเองอัตโนมัติ):
    = count(การ์ดที่ bucket = DONE สัปดาห์นี้ AND bucket ≠ DONE สัปดาห์ก่อน)
      คำนวณจาก TaskStateSnapshot เทียบ larkTaskGuid
      แสดงป้าย "เสร็จใหม่สัปดาห์นี้"
```
> Lark ไม่เก็บ "การ์ดย้ายเข้า section เมื่อไหร่" → snapshot คือทางเดียว นี่คือเหตุผลที่ต้อง deploy เร็ว

---

## 7. API

```
GET /api/qa/summary?week=&projectCode=&testerId=
GET /api/qa/workload?week=&projectCode=      → { groups[], total, checksum }
GET /api/qa/blockers?projectCode=            → { count, items[] }   ← count กับ items ต้องมาจาก query เดียวกัน
GET /api/qa/throughput?weeks=12
GET /api/qa/board?week=
```

---

## 8. เฟสถัดไป (ต้องเพิ่ม custom field ใน Lark ก่อน)

รูป "QA Executive Summary" ที่ข้าวส่งมามี metric ที่ Lark Task ให้ไม่ได้ในวันนี้:

| metric ในรูป | ทำได้ไหมตอนนี้ | ต้องมีอะไรก่อน |
|---|---|---|
| Test Progress (963/1,240 test cases) | ❌ | ต้องมีระบบ test case management จริง — **ไม่แนะนำทำใน Lark Task** |
| Pass Rate 91% | ❌ | ใช้ **proxy แทนในเฟส 1**: `อัตรางานที่ผ่านฉลุย = 1 − (Fail bug / เสร็จทั้งหมด)` |
| Open Defects by Severity P0–P3 | ⚠️ | custom field `severity` (single select P0/P1/P2/P3) + `task_type` (Test Case / Bug / Support) บนทุก tasklist |
| Quality Trend | ✅ หลังสะสม snapshot | — |
| Go-live Readiness | ⚠️ | สูตร: `พร้อม` เมื่อ blocker = 0 AND P0 = 0 AND P1 ≤ 2 AND % เสร็จ ≥ 95 — **⚠️ รอข้าวยืนยันเกณฑ์** |

**ให้ทำ proxy metric ในเฟสนี้ก่อน อย่ารอ custom field** แล้วค่อยเปลี่ยนมาใช้ของจริงเมื่อทีมเริ่มกรอก

---

## 9. Definition of Done ของเฟส QA

- [ ] `AUS_SILVER` → ค้าง 41 / เสร็จ 0 / Active 41 / blocker 0 (regression ผ่าน)
- [ ] `MYGOLD_BSEA` ดึงได้ครบ ~281 ใบ (ไม่ใช่ 183 — ทดสอบ pagination)
- [ ] KPI blocker กับ list blocker มาจาก response เดียวกัน (มี test ครอบ)
- [ ] donut workload มีกลุ่ม "ไม่ระบุผู้รับผิดชอบ" และมีบรรทัดตรวจยอด
- [ ] ทุกตัวเลข drill-down ได้และลิงก์กลับ Lark
