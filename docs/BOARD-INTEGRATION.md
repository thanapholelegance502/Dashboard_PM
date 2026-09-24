# BOARD-INTEGRATION — สัญญาการเชื่อมบอร์ดแผนกเข้า Portal

> สำหรับทีมแผนก (QA/Tester, BA, UX, C-level) ที่มี repo dashboard ของตัวเอง แล้วต้องการให้เปิดจาก Portal เดียวกับ PM
> อ่านก่อนเริ่มเชื่อม · คนดูแล portal = ข้าว (PM)

## ภาพรวม

```
ผู้ใช้ ─HTTPS─► ingress (Caddy / Cloudflare) ─► nginx (web) ─┬─ /            → Portal (SPA: landing, PM, การเงิน, ตั้งค่า)
                                                           ├─ /api/        → PMO backend (login, สิทธิ์, ข้อมูล PM)
                                                           └─ /qa/…        → [เช็กสิทธิ์บอร์ด QA] → แอปของทีม QA
```

1. ผู้ใช้ login ด้วย Lark **ครั้งเดียวที่ Portal** → หน้า landing โชว์การ์ดบอร์ดที่ตัวเองมีสิทธิ์
2. กดการ์ด QA → เปิด `/qa/` → nginx ถาม `/api/auth/check?board=QA` ก่อน **ทุก request** (ทั้งหน้าเว็บ, JS, API ของแอป)
   - ยังไม่ login → เด้งไปหน้า login · ไม่มีสิทธิ์ → เด้งกลับ landing
   - ผ่าน → ส่งต่อให้แอปของทีม พร้อม header บอกว่าใครใช้งานอยู่
3. สิทธิ์บอร์ดรายคน ตั้งโดย Admin ที่ **ตั้งค่า → ผู้ใช้** (ติ๊กบอร์ด PM / QA / C-level)

ทะเบียนบอร์ดอยู่ที่ `server/src/domain/boards.js` (เพิ่มบอร์ดใหม่ = แก้ไฟล์นี้ + nginx + compose — ดูท้ายเอกสาร)

---

## สิ่งที่แอปของทีมแผนกต้องทำ (สัญญา)

### 1. อยู่ใต้ path ของบอร์ดได้ (`BASE_PATH`)
- แอปจะถูกเรียกที่ `https://<domain>/<board>/…` เช่น `/qa/` — nginx ส่ง **path เต็ม** (`/qa/api/x`) มาให้ แอปต้องตัด prefix เอง
- ตั้งผ่าน env `BASE_PATH=/qa`
- **ห้ามมี URL ที่ขึ้นต้นด้วย `/` แบบ hardcode** (redirect, fetch, ลิงก์, `<script src>`) — ต้องต่อ `BASE_PATH` หรือใช้ path แบบ relative
  ไม่งั้นจะเด้งออกไปหน้า Portal

### 2. ไม่ต้องทำระบบ login ของคนดูเอง
- Portal กั้นให้แล้ว — request ที่มาถึงแอป = ผ่านการเช็กสิทธิ์แล้วเสมอ
- ตัวตนผู้ใช้อ่านจาก header ที่ nginx ส่งมา:

  | header | ตัวอย่าง | ใช้ทำอะไร |
  |---|---|---|
  | `X-Portal-User` | `somchai@elegance.co.th` | รู้ว่าใครดู / ใครกดแก้ (log การกระทำ) |
  | `X-Portal-Role` | `ADMIN` / `PM` / `VIEWER` | ซ่อนปุ่มตั้งค่าที่อันตรายจาก VIEWER |

- header นี้เชื่อถือได้ **เพราะแอปเข้าถึงได้ทาง nginx เท่านั้น** (nginx ทับค่าที่ client ส่งมาเองทุกครั้ง)
  → **ห้ามเปิด port ของแอปออกนอกเครื่อง** (ใน compose ใช้ `expose` ไม่ใช่ `ports`)
- หน้าตั้งค่าที่เปลี่ยน Lark connection / cron ของแอป ควรเช็ก `X-Portal-Role` ว่าเป็น `ADMIN` หรือ `PM`

### 3. Database — เราสร้าง database แยกให้ ทีมจัดการ schema เอง
- Portal ใช้ Postgres ตัวเดียว แต่ **แต่ละแผนกได้ database + user ของตัวเอง** (ไม่แชร์ตารางกับ `pmo`)
  ```bash
  bash scripts/create-board-db.sh qa     # → user qa_app + database qa (รันบน server)
  ```
- user ของแผนก **เข้า database `pmo` ไม่ได้** (กันข้อมูลโปรเจกต์/การเงินรั่ว ถ้าแอปแผนกมีช่องโหว่)
- ทีมสร้าง/แก้ตารางเองในโค้ด (`CREATE TABLE IF NOT EXISTS` หรือ migration ของทีม) — Portal ไม่สร้างตารางให้
- Postgres ภายใน docker **ไม่มี SSL** → แอปต้องปิด SSL ได้ผ่าน env เช่น `DATABASE_SSL=false`
- ต้องการข้อมูลจาก ETL กลาง (task/section ของ Lark ที่ PM sync อยู่แล้ว)? → อย่าต่อ DB `pmo` ตรง ๆ รอเฟส 2 (API กลาง ด้านล่าง)

### 4. Secret / key ห้ามอยู่ใน repo
- `.env`, token, private key, `*.pem` → `.gitignore` ตั้งแต่วันแรก
- ถ้าเคย commit key ไปแล้ว: **ลบไฟล์ไม่พอ** (ยังอยู่ใน git history) → ต้อง **ออก key ใหม่** แล้วเลิกใช้ key เก่า

### 5. Deploy — แบบเดียวกับ PM (merge main แล้วขึ้นเอง)
- repo ต้องมี `Dockerfile` ที่ build แล้วรันได้เลย · port ตามที่ตกลง (QA = 5173)
- ข้อมูลที่ต้องรอด restart (token, ตั้งค่า) เก็บใน **โฟลเดอร์เดียว** เพื่อ mount เป็น volume (QA = `/app/config`)
- ใส่ GitHub Actions แบบเดียวกับ `Dashboard_PM/.github/workflows/deploy.yml` → merge main = build + push image `ghcr.io/thanapholelegance502/<repo>:latest`
  → Watchtower บน server ดึงไปเปลี่ยนเอง (ดู [CICD.md](CICD.md))
- ช่วงที่ยังไม่มี CI: build บน server เอง (ดูหัวข้อ "ติดตั้งบน server")

---

## ✅ Checklist สำหรับ repo `Dashboard_Tester` (ทีม QA)

สำรวจโค้ดเมื่อ 24 ก.ย. 2026 — แอป QA ใช้ `BASE_PATH` ได้อยู่แล้ว (ดีมาก) เหลือแก้:

| # | ต้องแก้ | ไฟล์ | ทำไม |
|---|---|---|---|
| 1 | redirect หลัง Lark login จาก `'/?lark_login=success'` → ต่อ `BASE_PATH` | `server.js` (callback `/api/lark/oauth/callback`) | ไม่งั้นหลังเชื่อม Lark จะเด้งออกไปหน้า Portal |
| 2 | เพิ่ม env `DATABASE_SSL` (false = ไม่ใช้ SSL) | `server/db.js` (ตอนนี้บังคับ SSL เมื่อ host ไม่ใช่ localhost) | ไม่งั้นต่อ database `qa` ในเครื่อง portal ไม่ได้ |
| 3 | ลบ `oracle_key`, `oracle_key.pub` ออกจาก repo **และออก key ใหม่** | root ของ repo | ไฟล์ key ถูก commit ไว้ — อยู่ใน history แล้ว |
| 4 | เพิ่ม `.github/workflows/deploy.yml` (build + push GHCR) | ใหม่ | ให้ merge main แล้ว server อัพเดทเอง |
| 5 | (แนะนำ) หน้าตั้งค่า Lark / cron ให้เฉพาะ `X-Portal-Role` = ADMIN/PM | `server.js` | กัน VIEWER ไปเปลี่ยนการเชื่อม Lark ของแอป |

ลำดับที่แนะนำ: ข้อ 3 ก่อน (ความปลอดภัย) → 1 → 2 → 4

---

## ติดตั้งบน server (ข้าว / คนดูแล portal)

### ครั้งแรก — บอร์ด QA
```bash
cd ~/Dashboard_PM
# 1) โค้ดแอป QA → image (ช่วงที่ repo tester ยังไม่มี CI)
git clone https://github.com/thanapholelegance502/Dashboard_Tester.git ~/Dashboard_Tester
docker build -t ghcr.io/thanapholelegance502/dashboard_tester:latest ~/Dashboard_Tester

# 2) ตั้งค่าแอป QA
cp qa.env.example qa.env && nano qa.env      # เฟส 1: DATABASE_URL = Supabase เดิมของทีม tester

# 3) เปิด profile qa (root .env)
sed -i 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=caddy,qa/' .env

docker compose -f docker-compose.prod.yml up -d --scale watchtower=0
```
- Lark Console: เพิ่ม redirect URI `https://<domain>/qa/api/lark/oauth/callback` (สำหรับ sync ของแอป QA)
- ตั้งค่า → ผู้ใช้: ติ๊กบอร์ด **QA** ให้ทีม tester

### อัพเดทแอป QA (ช่วงยังไม่มี CI)
```bash
git -C ~/Dashboard_Tester pull
docker build -t ghcr.io/thanapholelegance502/dashboard_tester:latest ~/Dashboard_Tester
docker compose -f docker-compose.prod.yml up -d qa
```

### ย้าย DB ของ QA มาไว้ในเครื่อง (หลังทีม tester ทำ checklist ข้อ 2)
```bash
bash scripts/create-board-db.sh qa    # จด DATABASE_URL ที่ได้ → ใส่ qa.env + DATABASE_SSL=false
docker compose -f docker-compose.prod.yml up -d qa
```
> backup: เมื่อตั้ง backup DB รายวัน ต้องรวม database `qa` ด้วย (ดู STATUS.md)

---

## เพิ่มบอร์ดแผนกใหม่ (เช่น BA, C-level เมื่อ repo มีแอปแล้ว)
1. `server/src/domain/boards.js` — เปลี่ยน `kind` เป็น `external` + ใส่ `path: '/ba/'`
2. `web/nginx.conf` — copy บล็อก `/_auth/qa` + `/qa/` เปลี่ยนเป็น `ba` (board=BA, upstream `http://ba:<port>`)
3. `docker-compose.prod.yml` — copy service `qa` เป็น `ba` (profile `ba`, image, env_file `ba.env`, volume)
4. `bash scripts/create-board-db.sh ba` (ถ้าต้องใช้ DB)
5. ส่งเอกสารนี้ให้ทีมแผนกทำตามหัวข้อ "สิ่งที่แอปต้องทำ"

---

## เฟส 2 — API กลาง (ยังไม่ทำ)
ตอนนี้แอป QA sync จาก Lark เอง (ซ้ำกับ ETL ของ PM) → ตัวเลขสองฝั่งอาจไม่ตรงกัน
เป้าหมาย: PMO backend เปิด API อ่านอย่างเดียวให้บอร์ดแผนก (task / section / assignee / snapshot ต่อ dept)
แล้วแอปแผนกเลิก sync เอง — ต้องคุยกับทีม QA ก่อนว่าใช้ข้อมูลอะไรบ้าง (subtask / defect ที่ ETL กลางยังไม่ sync)
