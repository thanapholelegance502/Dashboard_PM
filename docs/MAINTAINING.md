# MAINTAINING — คู่มือดูแลระบบ (day-2 ops)

> สำหรับคนที่มารับช่วงดูแลต่อ · อ่าน [README](../README.md) + [ARCHITECTURE](ARCHITECTURE.md) ก่อน

---

## งานประจำ

### ดู sync ว่าทำงานปกติ
- cron ดึงอัตโนมัติ 08:00 / 17:00 (Asia/Bangkok) เมื่อ backend รันอยู่
- เช็คประวัติ: หน้า Admin (จะเพิ่มแท็บสถานะระบบ) หรือ query `SyncRun` ล่าสุด
```sql
SELECT id, status, trigger, "tasksFetched", "projectsFail", "startedAt"
FROM "SyncRun" ORDER BY id DESC LIMIT 10;
```
- `status`: SUCCESS ปกติ · PARTIAL = บางบอร์ดดึงไม่ได้ (ดู errorText) · FAILED = พังทั้งรอบ

### Sync ด้วยมือ
- ปุ่ม **Sync now** บนหน้า PM · หรือ `cd server && npm run sync:once`

---

## เหตุการณ์ที่ต้องจัดการ

### 🔴 Token Lark หมด / "ต้อง re-authorize"
เกิดเมื่อ refresh token พัง (ข้าวเปลี่ยน password / เพิกถอนสิทธิ์ / ไม่ได้ sync นานมาก)
```bash
cd server && npm run lark:authorize
```
→ เปิด URL → **ข้าว (เจ้าของ token)** login + กดอนุญาต → token ใหม่เขียนลง DB

> ETL ใช้ token ในนาม "ข้าว" (user_access_token) — ต้องเป็นคนเดิมที่เป็นสมาชิกทุกบอร์ด

### เพิ่มบอร์ด/โปรเจกต์ใหม่
1. Admin → โครงการ → **+ เพิ่มโครงการ** → วาง Lark `tasklist_guid` (ก็อบจาก URL บอร์ด)
2. **ข้าวต้องเป็นสมาชิกบอร์ดนั้นใน Lark** ไม่งั้นดึงไม่ได้ (403)
3. Sync now
4. Admin → **Section Rules** → banner เตือน section ที่ยังไม่ map → กด map → เลือก dept/bucket/weight → บันทึก (recompute ทันที)

### progress/ตัวเลขเพี้ยนหลังเพิ่มบอร์ด
= section ใหม่ยังไม่ map (`deptCode=NONE`, weight 0 ดึง progress ลง) → ดู banner ในแท็บ Section Rules แล้ว map

### แก้ weight / การจัดกลุ่ม section
Admin → Section Rules → แก้ dept/bucket/weight inline → recompute อัตโนมัติ (ไม่ต้องยิง Lark ใหม่)

---

## Backup

```bash
# สำรอง DB รายวัน (cron)
pg_dump pmo > pmo_$(date +%F).sql

# กู้คืน
psql pmo < pmo_YYYY-MM-DD.sql
```
> ข้อมูลการ์ดดึงจาก Lark ใหม่ได้เสมอ · **สิ่งที่ backup สำคัญ** = ที่กรอกมือ: budget/งวดการเงิน, milestone dates, override, section rules, snapshot ประวัติ

---

## Troubleshoot

| อาการ | สาเหตุ / แก้ |
|---|---|
| sync FAILED + "REAUTHORIZE" | token พัง → `npm run lark:authorize` |
| sync PARTIAL บางบอร์ด | ข้าวไม่ได้เป็นสมาชิกบอร์ด / บอร์ดถูกลบ → ดู `SyncRun.errorText` |
| ดึงการ์ดไม่ครบ | pagination — เช็ค `SyncRun.pagesFetched` (ต้องวนจน has_more=false) |
| 502 ตอน authorize/token | host ผิด — ต้องใช้ accounts/open (ดู ARCHITECTURE 3-host) |
| progress เพี้ยน/ต่ำ | section ยังไม่ map → banner Admin |
| KPI blocker ≠ list | ต้องมาจาก query เดียว (มี test ครอบ — อย่าแยกคำนวณ) |
| หน้าเว็บ error โหลด API | backend :3000 รันอยู่ไหม · proxy /api ถูกไหม |

---

## ก่อนแก้ logic — อ่าน spec
`00-MASTER.md` … `06-BUILD-PLAN.md` = สเปกกลาง (กติกาที่ล็อกแล้ว, สูตร KPI, bucket engine)
กติกาห้ามละเมิด → [STATUS.md](STATUS.md) ท้ายไฟล์

## Test ก่อน commit
```bash
cd server && npm test        # 56 tests
cd web && npm run build      # TS ไม่ error
```
