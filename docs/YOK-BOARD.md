# บอร์ด YOK — Project Executive Dashboard (อ่าน Google Sheet ฝั่ง server)

> บอร์ดของทีม PM อีกสาย (หยก) · ย้ายจากเว็บนอกที่อ่านชีตจาก browser → มาอ่านฝั่ง server ด้วย service account
> เป้าหมาย: ชีตเลิกเปิดสาธารณะ · บอร์ดอยู่หลัง Lark SSO + สิทธิ์รายคนเหมือนบอร์ดอื่น

---

## 1. ทำไมต้องย้าย

เว็บเดิม `pm-pulse-elegance.rotsukon.chatgpt.site` เปิดสาธารณะ ไม่มี login และ `app.js` อ่านชีต **จาก browser ของผู้ใช้** ผ่าน gviz JSONP โดยมี sheet ID อยู่ในหน้าเว็บ

วิธีนี้บังคับให้ชีตต้องแชร์เป็น "anyone with the link" ตลอดเวลา → **ใครรู้ sheet ID ก็ดึงข้อมูลดิบจาก Google ได้ตรง ๆ โดยไม่ต้องผ่านเว็บเลย** ในชีตมีชื่อลูกค้าจริงและมูลค่างาน

เป็นข้อจำกัดของวิธี ไม่ใช่การตั้งค่าผิด — อ่านชีตจาก client เมื่อไหร่ ชีตต้อง public เมื่อนั้น

**ซ่อนลิงก์หลัง Lark SSO ไม่ช่วย** · **reverse proxy ก็ไม่ช่วย** (browser ยังยิง Google เอง) · ทางเดียวคือย้ายการอ่านไปฝั่ง server แล้วถอด public sharing

---

## 2. ตั้งค่า (โหมดปัจจุบัน: gviz — ไม่ต้องต่อ Google API)

`server/.env.production`:
```dotenv
YOK_SHEET_ID=<id ของชีต>
YOK_SOURCE=gviz            # default · ไม่ต้องมี credential
# YOK_CRON_MORNING=0 9 * * *
# YOK_CRON_EVENING=0 17 * * *
```
แค่นี้ · ไม่ต้องสมัคร Google Cloud ไม่ต้องมี key

### 🔴 ข้อแลกเปลี่ยนของโหมด gviz
gviz คือ endpoint เดียวกับที่เว็บเดิมของหยกใช้ — **ทำงานได้เฉพาะตอนชีตแชร์เป็น "anyone with the link"**

แปลว่า **ชีตต้องเปิดสาธารณะต่อไป** → ใครรู้ sheet ID ก็ยังดึงข้อมูลดิบจาก Google ได้ตรง ๆ โดยไม่ต้องผ่าน Portal เลย · รูที่ตั้งใจจะปิดยังเปิดอยู่

ข้อดีที่ได้จริง: รวมบอร์ดอยู่ที่เดียว · อยู่หลัง Lark SSO + สิทธิ์รายคน · ข้อมูลเก็บลง Postgres ของเรา (Google ล่มหน้าไม่ว่าง)

### วิธีปิดชีตจริง (โหมด api) — เมื่อพร้อม
ต้องมี Google service account · เปลี่ยน `YOK_SOURCE=api` แล้วใส่ key · **โค้ดพร้อมอยู่แล้ว ไม่ต้องเขียนใหม่**

1. `console.cloud.google.com` → New Project `elegance-pmo-sheets` (ไม่ต้องผูกบัตร Sheets API ฟรี)
2. APIs & Services → Library → `Google Sheets API` → **Enable**
3. Credentials → Create credentials → **Service account** ชื่อ `pmo-sheets-reader`
4. **ข้ามขั้น "Grant this service account access to project" ทั้งขั้น** — สิทธิ์มาจากการแชร์ชีต ไม่ใช่ IAM
5. เข้า SA → **Keys** → Add key → Create new key → **JSON** · **Google ไม่เก็บสำเนา**
6. ชีต → Share → วางอีเมล SA → **Viewer** → เอาติ๊ก Notify people ออก
7. `scp` key ไป `/opt/pmo/server/secrets/yok-sa.json` → `chmod 600` · เพิ่ม volume `:ro` ใน `docker-compose.prod.yml`
8. env: `YOK_SOURCE=api` + `GOOGLE_SA_KEY_FILE=/run/secrets/yok-sa.json`
9. ทดสอบว่า `/yok` ยังขึ้นข้อมูล → **ค่อยถอด "Anyone with the link" ออกจากชีต**
10. ลบไฟล์ JSON จาก Downloads และจากทุกแชทที่มันผ่าน

⚠️ ขั้น 9 คือขั้นที่ปิดรูจริง · **เว็บเดิมของหยกจะพังทันทีตอนนั้น** หยกต้องปิดเว็บ ไม่งั้นกลายเป็นหน้าพังสาธารณะที่ยังโฆษณา sheet ID อยู่
⚠️ ถอด public sharing หยุดการเข้าถึงในอนาคต **ไม่ได้เรียกคืนของที่ถูกดึงไปแล้ว**

> ห้ามใช้ `GOOGLE_SA_PRIVATE_KEY` ที่มี `\n` (พังเงียบเป็น `ERR_OSSL_UNSUPPORTED`) · ห้ามใช้ ADC (บน VM จะ fallback ไป metadata server เงียบ ๆ)

---

## 3. การกวาดข้อมูล

cron **09:00 / 17:00** (Asia/Bangkok) → เขียนลงตาราง `YokSnapshot` ทุกรอบ
หน้าเว็บอ่าน **snapshot ที่สำเร็จล่าสุด** เสมอ → restart / deploy / Google ล่ม แล้วหน้าไม่ว่าง (MASTER §12.4)
รอบที่ล้มเก็บไว้เป็นแถว `ok=false` **ไม่ทับรอบที่สำเร็จ** และหน้าเว็บขึ้นแถบแดงบอกว่ารอบล่าสุดล้ม

กวาดเองทันที: ปุ่ม **"ดึงข้อมูลใหม่"** มุมขวาบน (ADMIN/PM) หรือ `POST /api/yok/refresh`

### โครงสร้างชีตที่สำรวจแล้ว (7 แท็บ)
| แท็บ | หัวตารางแถว | หมายเหตุ |
|---|---|---|
| `Config` | 1 | คอลัมน์ J "ชื่อแท็บโครงการ" = **ทะเบียนโครงการจริง** (PJ01…PJ18) |
| `Weekly_Update` | 2 | **1 แถวต่อสัปดาห์ ไม่ใช่ต่อโครงการ** — ไม่มี Project ID |
| `Milestone` | 0 | หัว "วันที่คาดว่าจะเสร็จ" อยู่ index 4 แต่ข้อมูลอยู่ index 3 (merged เลื่อน) |
| `Executive_Action` | 0 | สถานะเป็นไทย — "อนุมัติแล้ว" = ปิดเรื่อง |
| `Pending_Kickoff` | 0 | ดีลที่ยังไม่เปิดโครงการ — **ไม่มี Project ID** |
| `Project_Billing` | 2 | **มี 2 ตารางซ้อนกัน** (ดูข้างล่าง) |
| `MA_Tracking` | 2 | คอลัมน์หัวว่างหลายตัว |

### ‼️ `Project_Billing` มี 2 ตารางในแท็บเดียว
ตารางที่ 1 (สรุปรายโครงการ) → banner `PROJECT PAYMENT SCHEDULE` คั่น → ตารางที่ 2 (งวดชำระรายงวด)
อ่านรวมกัน = **นับเงินซ้ำ** · โค้ดตัดด้วย regex ของ banner ไม่ใช่เลขแถว (`stopWhen` / `startAfter` ใน `mapping.js`) → หยกแทรกแถวข้างบนแล้วไม่พัง

### คอลัมน์หัวว่าง (merged cell — gviz ไม่คืน label)
`mapping.js` ตรึง index ด้วย `col: N` **พร้อมหลักฐานกำกับทุกตัว ไม่ได้เดา**:
- Billing: `[4] × 1.07 = [5]` (ก่อน VAT / รวม VAT) · `[7] + [8] = [5]` (เก็บแล้ว / ค้างเก็บ)
- งวด: `[6] + [7] = [8]` ทุกแถว (ก่อน VAT + VAT = รวม VAT)
- MA: `[6]` = มูลค่าโครงการ (ตรงกับ Billing ของ project เดียวกัน) · `[8] = [6] × 12%` ตรงกับหมายเหตุในชีต

**ยืนยันอิสระ:** ยอด `ค้างเก็บ` รวมที่คำนวณได้ = **฿3,480,289.70** ตรงเป๊ะกับตัวเลขที่หยกเขียนไว้เองในหัวตารางชีต

🔴 **`col` เพี้ยนเงียบ ๆ ถ้าหยกแทรก/ลบคอลัมน์** → ขอให้หยกใส่หัวตารางให้ครบ แล้วย้ายมาใช้ alias

### ที่ยังไม่ได้ทำ
แท็บรายโครงการ (`PJ01`…`PJ18`) ยังไม่ได้อ่าน → **stage / สถานะรายโครงการยังว่าง** และหน้าเว็บขึ้นหมายเหตุบอกตรง ๆ ไม่แกล้งว่ามีข้อมูล

---

## 4. โครงสร้างโค้ด

```
server/src/sheets/          ← ชั้นที่คุยกับ Google (คู่กับ server/src/lark/)
  auth.js      service account → access token (google-auth-library)
  client.js    axios + backoff + แยกชนิด error (403 rate limit vs 403 ไม่มีสิทธิ์)
  cache.js     TTL 60 วิ + เสิร์ฟของเดิมเมื่อ Google ล่ม + single-flight
  mapping.js   ★ หัวคอลัมน์ทั้งหมดอยู่ที่นี่ที่เดียว
  rows.js      หาแถวหัวตาราง + map field (pure)
  yokSource.js ตัวประกอบร่าง (ที่เดียวที่ไม่ pure)

server/src/domain/          ← คำนวณล้วน test ได้ไม่ต้องมี DB/network
  yokParse.js  วันที่ (serial / day-first / พ.ศ.) · เงินบาท · %
  yokStage.js  13 ขั้น เรียงลำดับ
  yokHealth.js 6 สถานะ
  yokBoard.js  รวมเป็น 6 section + KPI

web/src/pages/Yok.tsx       ← หน้าเดียว 6 section
web/src/components/StageFunnel.tsx · YokHealthBadge.tsx
```

### จุดที่ตั้งใจทำแบบนี้
- **endpoint เดียว** `/api/yok/dashboard` — ทั้ง 6 section มาจาก `batchGet` ครั้งเดียว cache ก้อนเดียว → `asOf` เดียว ไม่มีทางที่การ์ดบนกับตารางล่างมาจากคนละ snapshot (MASTER §12.2)
- **ทุกแถวพก `rowRef`** → ลิงก์ "แถว N ↗" กลับไปที่ชีตได้ (MASTER §12.1) · เปิดได้เฉพาะคนที่มีสิทธิ์ชีต
- **Google ล่ม → เสิร์ฟข้อมูลรอบก่อน + แถบเตือนสีแดง** ไม่ใช่หน้าว่างหรือเลข 0 (MASTER §12.4)
- **200 แต่ทุกแท็บว่าง** ถือเป็นความผิดปกติ → เก็บของเดิมไว้ + `degraded` (failure เดียวที่หน้าตาเหมือนสำเร็จ)
- **ค่าว่าง = `null` ไม่ใช่ 0** — "ยังไม่กรอก" กับ "฿0" คนละเรื่อง (DESIGN-BRIEF §11)
- **`/api/yok/meta`** (ADMIN เท่านั้น) คืนโครงสร้าง + หัวคอลัมน์ที่ map ได้ **ไม่มีแถวข้อมูล**

### ⚠️ section การเงินของบอร์ดนี้ ≠ หน้า "การเงิน" ของ Portal
คนละแหล่งข้อมูลคนละชุด (ชีตหยก vs Postgres/Lark) **ตัวเลขจะไม่ตรงกันและไม่ควรตรงกัน** หัวข้อจึงเขียนว่า "การเงิน (จากชีตของหยก)" และ **ห้ามเอาสองที่มาบวกกันหรือ reconcile กัน** ทั้งในโค้ดและใน UI

---

## 5. ลำดับเปิดใช้

| # | ทำอะไร | ปิดรูหรือยัง |
|---|---|---|
| 1 | ใส่ `YOK_SHEET_ID` ใน `server/.env.production` → `up -d server` | ยัง |
| 2 | กด "ดึงข้อมูลใหม่" ในหน้า `/yok` (หรือรอ cron 09:00/17:00) | ยัง |
| 3 | ติ๊กสิทธิ์ `YOK` ให้หยก + ผู้บริหาร | ยัง |
| 4 | หยกไล่เทียบตัวเลขกับเว็บเดิมทีละ section แล้วเซ็นรับ | ยัง |
| 5 | **ย้ายไปโหมด api (§2) แล้วถอด public sharing** | **ปิดแล้ว** |

ขั้น 1–4 ใช้เวลาไม่กี่นาที · **ขั้น 5 คือขั้นเดียวที่แก้ปัญหาความปลอดภัย** — หยุดที่ 4 = ยังไม่ได้ปิดอะไร

## 6. ดูแลต่อ

**หัวคอลัมน์เปลี่ยน** → บอร์ดขึ้น error บอกชื่อแท็บ + field + alias ที่ลองแล้ว + หัวที่เจอจริง → เพิ่ม alias ใน `mapping.js`
**แท็บถูก rename** → ขึ้น warning `tabMissing` ไม่ทำให้ทั้งบอร์ดพัง
**หมุน key** → ออก key ใหม่ใน GCP → แก้ไฟล์บน host → `docker compose up -d server` → ลบ key เก่าใน console
**ถ้า key เคยหลุดเข้า git** → **ออก key ใหม่ ลบไฟล์อย่างเดียวไม่พอ**
**`npm run sheets:headers` ล้ม** → `sheetAccess` = SA ยังไม่ได้สิทธิ์ Viewer · `sheetMissing` = `YOK_SHEET_ID` ผิด
