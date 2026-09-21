# 04 — BA DASHBOARD (เฟส 5)

> อ่าน `00-MASTER.md` ก่อน
> ⛔ **อย่าเริ่มไฟล์นี้จนกว่า PM + QA จะ review ผ่าน และ blocked-on ด้านล่างถูกปลด**

---

## 1. ความจริงที่ต้องยอมรับก่อนเริ่ม

รูป "BA Executive Dashboard" ที่ข้าวส่งมา **ส่วนใหญ่ทำจากข้อมูลที่มีอยู่วันนี้ไม่ได้** เพราะ:

1. งาน BA ในบอร์ดโปรเจกต์มีแค่ section `BA` และ `Waiting for Client` → ได้แค่ "งานค้าง/เสร็จ" ไม่มี Work Type
2. **งาน Customer Support ที่เข้ามาทางไลน์ ไม่ได้อยู่ในบอร์ดโปรเจกต์เลย** → 44% ของรูป (14 จาก 32 งาน) ไม่มี source
3. ไม่มี field: Work Type · Module · Customer · Channel · Aging · Priority

**สรุป: BA dashboard ทำได้จริงราว 25% ของรูปถ้าไม่เปลี่ยนอะไร**

---

## 2. สิ่งที่ต้องทำใน Lark ก่อน (งานของทีม BA ไม่ใช่ของ dev)

### 2.1 สร้าง tasklist `BA-SUPPORT` (บอร์ดกลาง 1 บอร์ด ไม่แยกตามลูกค้า)
รับงาน Support / Change Request ที่มาจากไลน์/โทร ซึ่งไม่ผูกกับ sprint ของบอร์ดโปรเจกต์

sections: `New` · `Investigating` · `Waiting Dev` · `Waiting Customer` · `Waiting Confirm` · `Scheduled` · `Resolved` · `Cancelled` · `Blocked`

mapping (เพิ่มเข้า `SectionRule` ด้วย `deptCode = 'BA'`):

| section | bucket | weight |
|---|---|---|
| New | BACKLOG | 10 |
| Investigating | IN_PROGRESS | 30 |
| Waiting Dev | WAITING | 50 |
| Waiting Customer | WAITING | 50 |
| Waiting Confirm | WAITING | 70 |
| Scheduled | WAITING | 60 |
| Resolved | DONE | 100 |
| Cancelled | DONE | 100 |
| Blocked | BLOCKED | 50 |

### 2.2 Custom field ที่ต้องเพิ่ม (ทั้งบอร์ดโปรเจกต์และ `BA-SUPPORT`)

| field | type | ตัวเลือก | บังคับกรอกไหม |
|---|---|---|---|
| `work_type` | single select | Support · Requirement · Change Request · Meeting · Internal | ✅ บังคับ |
| `module` | single select | Payment · Stock · Trading · KYC · Report · UI · Order · Other | ✅ บังคับ |
| `priority` | single select | Urgent · High · Medium · Low | ✅ บังคับ |
| `customer_code` | text | ใช้ project_code | เฉพาะบอร์ด BA-SUPPORT |
| `channel` | single select | Line · Email · Phone · Meeting · In-app | เฉพาะบอร์ด BA-SUPPORT |

> **Aging ไม่ต้องทำเป็น field** — ระบบคำนวณเองจาก `larkCreatedAt` ถึงตอนนี้ (ถ้ายังไม่ Resolved) หรือถึง `completedAt`

---

## 3. Dashboard ที่จะได้ (เมื่อ §2 เสร็จ)

**KPI 6 ใบ:** งาน BA ทั้งหมด · Customer Support · Requirement · Change Request · Blocked · เกินกำหนด
แต่ละใบมี delta เทียบสัปดาห์ก่อน (จาก `DailyAggregate`)

**บล็อก:**
1. สัดส่วนประเภทงาน (donut ตาม `work_type`)
2. สถานะงาน Support (การ์ดเล็ก: New / Investigating / Waiting Dev / Waiting Customer / Resolved เดือนนี้)
3. ภาระงานต่อคน (stacked bar ต่อ BA แยกสีตาม work_type) — ใช้กติกากลุ่ม "ไม่ระบุผู้รับผิดชอบ" เหมือน `03-QA` §4
4. เคสลูกค้าที่เปิดค้าง Top 5 (เรียงตาม priority แล้ว aging) — คอลัมน์: เรื่อง · project_code · aging · priority
5. เรื่องที่ต้องให้ผู้บริหารตัดสินใจ — ใช้ `AttentionItem` ตัวเดียวกับ PM (กรองด้วย dept)
6. แนวโน้มปริมาณงาน 8 สัปดาห์ (stacked bar ตาม work_type จาก `DailyAggregate`)

---

## 4. ⛔ Blocked-on ของไฟล์นี้

| # | ติดอะไร | ใครปลด |
|---|---|---|
| BA1 | ทีม BA ยอมสร้างบอร์ด `BA-SUPPORT` + กรอก custom field ไหม (กระทบ workflow ทุกวัน) | ข้าว + หัวหน้า BA |
| BA2 | ตัวเลือกใน `module` ที่ตรงกับงานจริง | ทีม BA |
| BA3 | นับ "เคสลูกค้า" อย่างไรเมื่อลูกค้าแจ้ง 1 เรื่องแต่กระทบหลายโปรเจกต์ | ข้าว |
| BA4 | ย้อนหลังต้องการไหม — ถ้าต้องการต้อง import เคสเก่าเข้าบอร์ดใหม่ | ข้าว |

**ถ้า BA1 ไม่ผ่าน** → ลด scope เหลือ: งานค้าง/เสร็จของ section `BA` + `Waiting for Client` ต่อโปรเจกต์ + ภาระงานต่อคน + aging เท่านั้น (ประมาณ 25% ของรูป) แล้วบอกข้าวตรง ๆ ว่าได้เท่านี้
