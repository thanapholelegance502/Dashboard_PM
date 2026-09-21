# 05 — UX/UI DASHBOARD (เฟส 6)

> อ่าน `00-MASTER.md` ก่อน
> ⛔ **อย่าเริ่มจนกว่า PM + QA จะ review ผ่าน**

---

## 1. สถานะข้อมูลวันนี้

บอร์ดโปรเจกต์มี section `UXUI` เดียว → ได้แค่ "มีงานกี่ใบ ค้างกี่ใบ ใครถือ"
รูป "UX/UI Executive Summary" ต้องการเพิ่ม: Rework Rate · Design QA Pass · On-time Delivery · Business Impact

| metric ในรูป | ทำได้ตอนนี้ | หมายเหตุ |
|---|---|---|
| Active Projects | ✅ | นับโปรเจกต์ที่มีการ์ด dept UXUI ค้าง |
| **On-time Delivery** | ✅ | `completedAt <= dueAt` / งานที่เสร็จทั้งหมดในช่วงนั้น — **ได้จาก Lark Task ตรง ๆ ไม่ต้องเพิ่มอะไร** |
| Task Status donut | ✅ | จาก bucket |
| Work Type Distribution | ❌ | ต้อง custom field |
| Rework Rate | ❌ | ต้อง custom field |
| Design QA Pass | ❌ | ต้อง custom field |
| Business Impact / Conversion / ROI | ❌ | เป็นข้อมูลธุรกิจของลูกค้า **ไม่มีทางดึงจาก Lark** — ต้องกรอกมือหรือตัดออก |

**ทำได้ทันที ~40%** — และ "On-time Delivery" คือ metric ที่มีค่าที่สุดของหน้านี้ เพราะตรงกับ pain point เรื่อง timeline ของข้าวโดยตรง

---

## 2. Section ที่ควรแตกเพิ่มใน Lark (ของดีที่สุดคือทำข้อนี้ ไม่ใช่ custom field)

แทนที่จะมี section `UXUI` เดียว ให้แตกเป็น flow จริงของทีม:

| section ใหม่ | bucket | weight |
|---|---|---|
| UXUI-Research | IN_PROGRESS | 22 |
| UXUI-Design | IN_PROGRESS | 26 |
| UXUI-Review | WAITING | 30 |
| UXUI-Rework | IN_PROGRESS | 24 |
| UXUI-Handoff | DONE | 34 |

ได้ทันทีโดยไม่ต้องกรอก field อะไรเลย:
- **Rework Rate** = การ์ดที่เคยผ่าน `UXUI-Rework` / การ์ดทั้งหมด → คำนวณจาก `TaskStateSnapshot` (เรามีประวัติ section รายวันอยู่แล้ว)
- **Work Type Distribution** = สัดส่วนการ์ดแต่ละ section
- **Design QA Pass** = `UXUI-Handoff / (UXUI-Handoff + UXUI-Rework)`

> นี่คือเหตุผลที่ `TaskStateSnapshot` เก็บ**ต่อการ์ดต่อวัน** ไม่ใช่แค่ยอดรวม — มันทำให้คำนวณ rework ย้อนหลังได้โดยไม่ต้องให้ใครกรอกอะไร

---

## 3. Custom field (ถ้า §2 ไม่พอ)

| field | type | ตัวเลือก |
|---|---|---|
| `ux_work_type` | single select | UX Research · UX Design · UI Design · Design System · Prototype · Design QA · Handoff |
| `business_impact` | single select | Conversion · Retention · Efficiency · Usability · Brand · Speed to Market |

Rework count / QA result **ไม่ต้องทำเป็น field** — ได้จาก §2 แล้ว

---

## 4. Layout

```
KPI: Active Projects · On-time Delivery % · Rework Rate % · Design QA Pass %
     (ทุกใบมี delta เทียบเดือนก่อน)
─────────────────────────────────────────────────────────
Project Health (ตาราง: progress, status, target date)  |  Task Status (donut)
Work Type Distribution (horizontal bar)
─────────────────────────────────────────────────────────
ต้องการการตัดสินใจ (จาก AttentionItem กรอง dept = UXUI)  |  งานโฟกัสถัดไป
```

**ตัด "UX/UI Impact on Business" (conversion/ROI/engagement) ออกจากเฟสนี้** — เป็นข้อมูลฝั่งลูกค้า เราไม่มี ถ้าใส่ตัวเลขปลอมลงไปจะทำลายความน่าเชื่อถือของทั้ง dashboard

---

## 5. ⛔ Blocked-on

| # | ติดอะไร | ใครปลด |
|---|---|---|
| UX1 | ทีม UX/UI ยอมแตก section ตาม §2 ไหม | ข้าว + หัวหน้า UX/UI |
| UX2 | ต้องการ Business Impact จริงไหม ถ้าต้องการข้อมูลมาจากใคร | ข้าว |
| UX3 | เกณฑ์ "on-time" นับจาก due date ในการ์ด — ทีมกรอก due date ครบไหม (ถ้าไม่ครบ metric นี้โกหก) | ข้าว |
