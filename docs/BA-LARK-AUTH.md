# BA-LARK-AUTH — เปลี่ยนการเชื่อม Lark ของแอป BA ให้เหมือน PM (สำหรับทีม BA)

> ส่งให้น้องทีม BA · ทำเป็น PR เข้า `main` ของ `Dashboard_BA` ตามปกติ (ข้าวรีวิว + merge)
> อ้างอิงโค้ดที่ใช้งานจริงอยู่แล้วใน Portal: `Dashboard_PM/server/src/lark/auth.js` (repo public อ่านได้)

## ทำไมต้องเปลี่ยน

| ตอนนี้ (แอป BA) | ปัญหา | แบบ PM (ใช้งานจริงแล้ว) |
|---|---|---|
| `tenant_access_token` (ตัวตน app/bot) | **Lark Task เชิญ bot เข้า tasklist ไม่ได้** → token ของ app มองไม่เห็นบอร์ด BA → sync ได้ "ไม่มีสิทธิ์" | **user_access_token** ในนามคนที่เป็นสมาชิกบอร์ด (กดปุ่ม "เชื่อม Lark" ครั้งเดียว) + refresh เองอัตโนมัติ |
| `TASKLIST_GUID` ใน env | คนตั้ง server ต้องไปหา guid เอง · เปลี่ยนบอร์ด = แก้ env + restart | **เลือกบอร์ดในหน้า Admin** (ระบบดึงรายชื่อ tasklist ที่บัญชีนั้นเห็นมาให้เลือก) เก็บใน DB |

Lark app ใช้ **ตัวเดียวกับ PM/QA** (App ID/Secret เดิม — ข้าวใส่ใน `ba.env` ให้แล้ว)

---

## 1. เชื่อม Lark แบบ user OAuth (เหมือน PM)

### Flow
```
/ba/admin ─ปุ่ม "เชื่อม Lark"─► GET /ba/api/admin/lark/authorize   (ADMIN/PM เท่านั้น)
   └─ 302 ─► accounts.larksuite.com/open-apis/authen/v1/authorize?client_id&redirect_uri&scope&state
        └─ user login + อนุญาต ─► GET /ba/api/lark/oauth/callback?code&state
             └─ แลก code → token · บันทึก DB · 302 /ba/admin?lark=connected (หรือ failed)
```

### 3 host แยกกัน (เจ็บมาแล้วที่ PM — ห้ามใช้ host เดียวทั้งหมด)
| ใช้ทำอะไร | URL |
|---|---|
| หน้า authorize (redirect user ไป) | `https://accounts.larksuite.com/open-apis/authen/v1/authorize` |
| แลก code / refresh token / user_info | `https://open.larksuite.com/open-apis/authen/v2/oauth/token` · `.../authen/v1/user_info` |
| Task / Section / Custom field / Contact API | `https://open-sg.larksuite.com/open-apis/...` |

ให้เป็น env 3 ตัว (default ตามตาราง): `LARK_AUTHORIZE_BASE`, `LARK_TOKEN_BASE`, `LARK_API_BASE` · เลิกใช้ `LARK_HOST` ตัวเดียว

### Request (ดูของจริงใน `Dashboard_PM/server/src/lark/auth.js`)
- **authorize**: `client_id=<LARK_APP_ID>` · `redirect_uri=<LARK_REDIRECT_URI>` · `scope=<ช่องว่างคั่น>` · `state=<สุ่ม>`
- **แลก code**: `POST .../authen/v2/oauth/token` (form) `grant_type=authorization_code, code, client_id, client_secret, redirect_uri` → `access_token, refresh_token, expires_in`
- **refresh**: `grant_type=refresh_token, refresh_token, client_id, client_secret`
- **scope** ขั้นต่ำ (เท่า PM): `task:task:read task:tasklist:read task:section:read contact:contact.base:readonly contact:user.base:readonly offline_access`
  + ของที่ BA ใช้เพิ่ม เช่น custom field → ใส่ scope ที่ Lark ต้องการ (ถ้า API ตอบ no permission ให้แจ้งข้าวเปิด scope ใน Developer Console)
- `redirect_uri` = `https://elegancedb.duckdns.org/ba/api/lark/oauth/callback` (env `LARK_REDIRECT_URI` · ข้าวลงใน Lark Console ให้)

### ‼️ กติกา token (สำคัญที่สุด — พลาดแล้วระบบตายถาวร)
1. **refresh_token หมุนทุกครั้งที่ใช้** → ได้ตัวใหม่ต้อง **เขียนทับใน DB ทันทีใน transaction เดียว** · ตัวเก่าใช้ไม่ได้อีก
2. refresh ใน transaction + `SELECT … FOR UPDATE` แถว token → กัน cron กับปุ่มกวาด Task refresh ชนกัน (อีกฝั่งรอ lock แล้วเช็กซ้ำว่ามีคน refresh ไปแล้วหรือยัง)
3. refresh ล้ม → **ห้ามเขียนทับด้วยค่าว่าง/ค่าพัง** · ตั้งสถานะ "ต้องเชื่อม Lark ใหม่" · ข้อมูลรอบก่อนยังแสดงได้ · หน้า admin ขึ้นแถบเตือน + ปุ่มเชื่อมใหม่
4. refresh ก่อนหมดอายุ ~5 นาที
5. เก็บ token **เข้ารหัส** ใน DB `ba` ด้วย `CREDENTIAL_ENC_KEY` (AES-256-GCM, key 32 byte base64 — ข้าวสร้างด้วย `openssl rand -base64 32`) · ห้าม log token/secret/code

### กันคนแอบผูกบัญชีตัวเอง (state)
- `state` สุ่มตอนกดปุ่ม → เก็บใน DB (ผูกกับ `X-Portal-User` + หมดอายุ 10 นาที) → callback รับเฉพาะ state ที่ตรงและยังไม่หมดอายุ แล้วลบทิ้ง · ไม่ตรง = 400 ไม่แลก code
- ปุ่ม authorize = `ADMIN`/`PM` เท่านั้น · บันทึก `audit_log` ว่าใครเชื่อม (email จาก header + ชื่อบัญชี Lark จาก `user_info`)

### หน้า `/ba/admin` — การ์ด "การเชื่อมต่อ Lark"
- สถานะ: ยังไม่เชื่อม / เชื่อมแล้วในนาม **<ชื่อบัญชี Lark>** (หมดอายุ … ) / ต้องเชื่อมใหม่
- ปุ่ม "เชื่อม Lark" / "เชื่อม Lark ใหม่"
- บัญชีที่ใช้เชื่อม = คนที่ **เป็นสมาชิกบอร์ด BA ใน Lark** (เช่น หัวหน้าทีม BA หรือข้าว)

---

## 2. เลือกบอร์ด (tasklist) ในหน้า Admin แทน `TASKLIST_GUID`

- หลังเชื่อม Lark แล้ว: `GET /ba/api/admin/lark/tasklists` → เรียก `GET {LARK_API_BASE}/task/v2/tasklists` (วนจน `has_more=false`) คืน `[{ guid, name }]`
- หน้า admin: dropdown เลือกบอร์ด + ช่องวาง guid เอง (สำรอง — ก็อบจาก URL บอร์ด) → `PUT /ba/api/admin/board` (ADMIN/PM · ลง `audit_log`)
- เก็บในตาราง `boards` ที่มีอยู่แล้ว — **อัปเดตแถวเดิม** (ข้อมูล snapshot ที่ import ไว้ผูกกับ board_id นี้ ห้ามสร้างแถวใหม่แล้วประวัติหาย)
- ลบ default guid ที่ hardcode ใน `server/sync/worker.js` (`getBoardId`) และเลิกอ่าน `TASKLIST_GUID` จาก env
- `larkReady()` = มี token ที่ใช้ได้ **และ** เลือกบอร์ดแล้ว
- cron: เปิดเองเมื่อพร้อม **โดยไม่ต้อง restart** (ตอนนี้เช็กครั้งเดียวตอน start) — เช่น เปิด cron เสมอ แล้วแต่ละรอบข้ามถ้ายังไม่พร้อม

---

## 3. env ที่เปลี่ยน (`.env.example`)
```bash
# ลบ: LARK_HOST, TASKLIST_GUID
LARK_APP_ID=
LARK_APP_SECRET=
LARK_REDIRECT_URI=https://elegancedb.duckdns.org/ba/api/lark/oauth/callback
LARK_AUTHORIZE_BASE=https://accounts.larksuite.com/open-apis
LARK_TOKEN_BASE=https://open.larksuite.com/open-apis
LARK_API_BASE=https://open-sg.larksuite.com/open-apis
CREDENTIAL_ENC_KEY=            # บังคับ — openssl rand -base64 32
```
dev ในเครื่อง: `LARK_REDIRECT_URI=http://localhost:8080/ba/api/lark/oauth/callback` (ข้าวเพิ่ม URI นี้ใน Lark Console ให้ได้ถ้าต้องทดสอบจริง) · หรือใช้ `fakeLark` ใน test

---

## 4. Test ที่ต้องมี (CI)
- refresh สำเร็จ → refresh_token ใหม่ถูกเขียนทับ · เรียกซ้อน 2 ครั้งพร้อมกัน → refresh จริงครั้งเดียว
- refresh ล้ม → token เดิมใน DB ไม่ถูกแก้ · สถานะ = ต้องเชื่อมใหม่
- callback state ไม่ตรง / หมดอายุ → 400 และไม่บันทึก token
- `VIEWER` เรียก authorize / tasklists / เลือกบอร์ด → 403
- เลือกบอร์ด → อัปเดตแถว `boards` เดิม (board_id ไม่เปลี่ยน)
- token/secret ไม่โผล่ใน log / response

## 5. หลัง merge (ข้าวทำ)
1. Lark Console → Security Settings → Redirect URLs เพิ่ม `https://elegancedb.duckdns.org/ba/api/lark/oauth/callback` · เช็ก scope ครบ
2. `ba.env`: ลบ `LARK_HOST`/`TASKLIST_GUID` · ใส่ `LARK_REDIRECT_URI` + `CREDENTIAL_ENC_KEY` (`openssl rand -base64 32`) → `docker compose -f docker-compose.prod.yml up -d ba`
3. เปิด `/ba/admin` → **เชื่อม Lark** (บัญชีที่อยู่ในบอร์ด BA) → **เลือกบอร์ด** → **กวาด Task ใหม่**
