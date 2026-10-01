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

## 2. ตั้งค่า service account (ข้าวทำเอง ครั้งเดียว)

### Google Cloud
1. `console.cloud.google.com` → ตัวเลือก project บนแถบบน → **New Project** ชื่อ `elegance-pmo-sheets` → Create
   *(ไม่ต้องผูกบัตร — Sheets API ฟรี)*
2. **APIs & Services → Library** → ค้น `Google Sheets API` → **Enable**
3. **APIs & Services → Credentials** → **+ Create credentials** → **Service account**
4. ชื่อ `pmo-sheets-reader` → Create and continue → **ข้ามขั้น "Grant this service account access to project" ทั้งขั้น** → Done
   *(สิทธิ์มาจากการแชร์ชีต ไม่ใช่ IAM — SA ต้องไม่มี role ใด ๆ เลย)*
5. คลิก `pmo-sheets-reader` → แท็บ **Keys** → Add key → Create new key → **JSON** → Create
   ⚠️ **Google ไม่เก็บสำเนา — ไฟล์ที่ดาวน์โหลดคือก๊อปเดียว**
6. copy อีเมล: `pmo-sheets-reader@elegance-pmo-sheets.iam.gserviceaccount.com`

### ชีต (หยกหรือข้าวที่มีสิทธิ์แก้)
7. เปิดชีต → **Share** → วางอีเมล SA → **Viewer** → **เอาติ๊ก "Notify people" ออก** (SA ไม่มีกล่องจดหมาย) → Share
8. 🔴 **ยังห้ามแตะ "Anyone with the link"** — นั่นคือขั้นสุดท้าย (§5)

### เอา key ขึ้น server (ห้ามผ่าน git ห้ามผ่านแชท)
```bash
scp pmo-sheets-reader-xxxx.json root@<vultr>:/opt/pmo/server/secrets/yok-sa.json
ssh root@<vultr> 'chmod 600 /opt/pmo/server/secrets/yok-sa.json && chown root:root /opt/pmo/server/secrets/yok-sa.json'
```
`server/.env.production` เพิ่ม:
```dotenv
YOK_SHEET_ID=<id ของชีต>
GOOGLE_SA_KEY_FILE=/run/secrets/yok-sa.json
# YOK_CACHE_TTL_MS=60000   # ไม่ใส่ก็ได้ default 60 วิ
```
`docker-compose.prod.yml` service `server` เพิ่ม volume:
```yaml
      - ./server/secrets/yok-sa.json:/run/secrets/yok-sa.json:ro
```
9. **ลบไฟล์ JSON ออกจาก Downloads และจากทุกแชทที่มันผ่าน**

> ทางสำรองถ้า mount ไม่สะดวก: `GOOGLE_SA_KEY_B64=<base64 ของไฟล์ทั้งไฟล์>` (บรรทัดเดียว ไม่ต้อง escape)
> **ห้าม**ใช้ `GOOGLE_SA_PRIVATE_KEY` ที่มี `\n` (พังเงียบเป็น `ERR_OSSL_UNSUPPORTED`) และ **ห้าม**ใช้ ADC (บน VM จะ fallback ไป metadata server เงียบ ๆ = ใช้ตัวตนผิดโดยดูเหมือนทำงานได้)

---

## 3. เติมหัวคอลัมน์ (ทำหลังขั้น 2 เสร็จ)

```bash
cd server && npm run sheets:headers
```
พิมพ์ชื่อแท็บ + **แถวหัวตารางอย่างเดียว ไม่แตะแถวข้อมูล** (ชีตมีชื่อลูกค้าจริง — MASTER §12.5)

เอาผลไปเติม `server/src/sheets/mapping.js` แล้วเปลี่ยน `headerRow: 'auto'` เป็นเลขแถวจริง

**`mapping.js` เป็นที่เดียวในโค้ดทั้งหมดที่ชื่อหัวคอลัมน์ปรากฏเป็น string** — หยก rename คอลัมน์เมื่อไหร่ เพิ่ม alias ตรงนั้นบรรทัดเดียว ไม่ต้องแก้ที่อื่น

### 4 ข้อที่ต้องถามหยก (ดูจากหัวตารางไม่ได้)
| # | คำถาม | กระทบอะไร |
|---|---|---|
| 1 | `Config` คอลัมน์ J คืออะไร | รายชื่อโครงการ + แท็บรายโครงการ |
| 2 | `Project_Billing` 1 แถว = 1 งวด หรือ 1 โครงการ | หน้าตา section การเงิน |
| 3 | แท็บรายโครงการตั้งชื่อยังไง (`loadSheet(tab)` — Project ID หรือ Project Name) | ขั้นตอน/สถานะรายโครงการ |
| 4 | คอลัมน์ % เก็บเป็น `0.75` หรือ `75` | ถ้าปนกันในคอลัมน์เดียว เดาอัตโนมัติไม่ได้ |

**ระหว่างที่ยังไม่รู้ข้อ 1/3:** หน้าบอร์ดประกอบรายชื่อโครงการจาก `projectId` ที่ปรากฏในแท็บอื่น และขึ้นหมายเหตุไว้ว่าขั้นตอน/สถานะยังว่าง — ไม่แกล้งว่ามีข้อมูล

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

## 5. ลำดับเปิดใช้ (ไม่มีจังหวะไหนที่ไม่มี dashboard ใช้)

| # | ทำอะไร | ระหว่างทาง | ปิดรูหรือยัง |
|---|---|---|---|
| 1 | ตั้ง service account + แชร์ชีตให้ (ยังไม่ถอด public) | เว็บหยกปกติ | ยัง |
| 2 | `npm run sheets:headers` → เติม `mapping.js` | ปกติ | ยัง |
| 3 | deploy → ติ๊กสิทธิ์ `YOK` ให้หยก + ผู้บริหาร | **สองที่พร้อมกัน** | ยัง |
| 4 | หยกไล่เทียบตัวเลขทีละ section แล้วเซ็นรับ | สองที่พร้อมกัน | ยัง |
| 5 | **ชีต → Share → "Anyone with the link" → Restricted** | `/yok` ปกติ · เว็บเดิมพัง (ตั้งใจ) | **ปิดแล้ว** |
| 6 | หยกปิด/redirect เว็บเดิม | — | ปิดครบ |

**ขั้นที่ปิดรูจริงคือ 5** — 1–4 คือการเตรียมให้ 5 ทำได้โดยไม่พัง · **หยุดที่ 4 แล้วไม่ทำ 5 = ยังไม่ได้แก้อะไร**

ขั้น 4 เผื่อเวลาจริงหลายวัน — เป็นโอกาสเดียวที่จะจับวันที่สลับวัน/เดือน หรือ % ผิด scale ก่อนของเดิมหายไป

ตรวจทันทีหลังขั้น 5: `/yok` ยังโหลดได้ (SA ยังมีสิทธิ์ Viewer) · เปิด gviz URL ใน incognito → ต้องได้ 401/404

**rollback:** ขั้น 1–4 ย้อนด้วย deploy เดิม · ขั้น 5 ย้อนด้วยเปิดแชร์กลับ 1 คลิก · **ห้ามลบเว็บเดิมจนกว่า `/yok` จะนิ่ง 1–2 สัปดาห์**

⚠️ **ถอด public sharing หยุดการเข้าถึงในอนาคต ไม่ได้เรียกคืนของที่ถูกเอาไปแล้ว** — ชีตเปิดสาธารณะมาระยะหนึ่ง ใครดึงไปแล้วก็มีอยู่ · เป็นเหตุผลที่ไม่ควรปล่อยขั้น 4 ยาวเป็นสัปดาห์

---

## 6. ดูแลต่อ

**หัวคอลัมน์เปลี่ยน** → บอร์ดขึ้น error บอกชื่อแท็บ + field + alias ที่ลองแล้ว + หัวที่เจอจริง → เพิ่ม alias ใน `mapping.js`
**แท็บถูก rename** → ขึ้น warning `tabMissing` ไม่ทำให้ทั้งบอร์ดพัง
**หมุน key** → ออก key ใหม่ใน GCP → แก้ไฟล์บน host → `docker compose up -d server` → ลบ key เก่าใน console
**ถ้า key เคยหลุดเข้า git** → **ออก key ใหม่ ลบไฟล์อย่างเดียวไม่พอ**
**`npm run sheets:headers` ล้ม** → `sheetAccess` = SA ยังไม่ได้สิทธิ์ Viewer · `sheetMissing` = `YOK_SHEET_ID` ผิด
