# 01 — DATA LAYER · Lark Integration + ETL

> อ่าน `00-MASTER.md` ก่อน · ไฟล์นี้คือชั้นเดียวที่คุยกับ Lark ชั้นอื่นห้ามเรียก Lark API ตรง

---

## 1. Lark App (ยืนยันแล้ว ใช้งานได้จริง)

| | ค่า |
|---|---|
| App name | `PM Management` |
| App ID | `cli_aa20a1d6d338def1` |
| App Secret | อยู่ใน `.env` ฝั่ง server เท่านั้น — `LARK_APP_SECRET` |
| **API host** (task/contact) | **`https://open-sg.larksuite.com/open-apis`** |
| **Authorize host** (browser login) | **`https://accounts.larksuite.com/open-apis`** |
| **Token host** (OAuth token/refresh) | **`https://open.larksuite.com/open-apis`** |

### ⚠️ กับดักที่เคยทำให้พังมาแล้ว (ยืนยันจริง 18 ก.ย.)

1. **มี 3 host แยกกัน — ห้ามใช้ open-sg ยิงทุกอย่าง** (เดิมสเปกเขียนว่า host เดียว = ผิด)
   - **task/contact API** → `open-sg.larksuite.com` (tenant อยู่ Lark unit สิงคโปร์ larksgaws)
   - **OAuth authorize UI** (หน้า login ที่ user กดอนุญาต) → `accounts.larksuite.com`
     ยิงหน้านี้ที่ open-sg ได้ **502 Bad Gateway** (open-sg เป็น API gateway ไม่ serve หน้า login)
   - **OAuth token/refresh** (`/authen/v2/oauth/token`) → `open.larksuite.com`
     ยิงที่ open-sg ได้ **502** เช่นกัน
   → ตั้ง 3 base URL ที่ `config/env.js` ที่เดียว (`LARK_API_HOST`, `LARK_AUTHORIZE_BASE`, `LARK_TOKEN_BASE`) ห้ามเขียน URL เต็มกระจาย
2. **authorize param = `client_id` ไม่ใช่ `app_id`** (v1 authorize บน accounts host)
3. **App ต้อง publish version จริง** ไม่ค้าง draft ไม่งั้น token ที่ได้จะเป็น `valid_for_app_id: false` เรียก API ไม่ได้

---

## 2. Auth = `user_access_token` (OAuth ในนามข้าว) — ไม่ใช่ tenant token

**เหตุผล:** Lark Task list เชิญ bot/แอปเข้าไม่ได้ (หน้าแชร์รับแค่คนหรือกลุ่ม) จึงต้องทำงานในนาม user ที่เป็นสมาชิก tasklist
→ **ผู้ authorize (ข้าว) ต้องเป็นสมาชิกของทุก tasklist ที่จะดึง** ถ้าเพิ่มโปรเจกต์ใหม่ ต้องเชิญข้าวเข้าบอร์ดก่อน ไม่งั้นได้ 403/ว่าง

### Scope ที่ต้องเปิดใน Developer Console (6 ตัว)
```
task:task:read
task:tasklist:read
task:section:read              ← จำเป็น ถ้าไม่เปิดจะอ่านชื่อ section ไม่ได้ = ระบบทั้งหมดใช้ไม่ได้
contact:contact.base:readonly
contact:user.base:readonly
offline_access                 ← จำเป็น ถ้าไม่เปิดจะไม่ได้ refresh_token
```

### Flow

```
ครั้งแรก (ทำมือครั้งเดียว ตอน setup — CLI: npm run lark:authorize):
  GET  {AUTHORIZE_BASE}/authen/v1/authorize?client_id=...&redirect_uri=...&scope=...&state=...
       (AUTHORIZE_BASE = accounts.larksuite.com · param client_id ไม่ใช่ app_id)
  → ข้าว login + กดอนุญาต → callback ได้ code
  POST {TOKEN_BASE}/authen/v2/oauth/token   { grant_type: "authorization_code", code, client_id, client_secret, redirect_uri }
       (TOKEN_BASE = open.larksuite.com)
  → { access_token, refresh_token, expires_in }
  → เขียนลงตาราง OAuthToken (provider = "lark")

รอบถัดไป (อัตโนมัติ):
  POST {TOKEN_BASE}/authen/v2/oauth/token   { grant_type: "refresh_token", refresh_token, client_id, client_secret }
  → ได้ access_token + refresh_token ใหม่
```

### ‼️ Refresh token rotation
Lark **หมุน refresh_token ทุกครั้ง** ที่ refresh → **ต้องเขียนทับค่าเดิมใน DB ทันทีในทรานแซกชันเดียวกัน**
ถ้าเขียนทับไม่สำเร็จ = refresh_token เก่าใช้ไม่ได้แล้ว และตัวใหม่ก็ไม่ได้เก็บ → **ระบบตายถาวร ต้องให้ข้าว authorize ใหม่ด้วยมือ**

กติกาที่ต้อง implement:
- refresh **ก่อน** token หมดอายุ 5 นาที (`expiresAt - 5min`)
- ใช้ **lock ระดับ DB** (`SELECT ... FOR UPDATE` บนแถว OAuthToken) กัน cron กับปุ่ม Run now refresh พร้อมกันแล้วชนกัน
- refresh ล้มเหลว → `SyncRun.status = FAILED`, errorText ชัดเจน, **และขึ้น banner แดงบน dashboard ว่า "ต้อง re-authorize Lark"** พร้อมปุ่มพาไปหน้า authorize
- มี CLI `npm run lark:authorize` สำหรับตั้งค่าครั้งแรก/กู้คืน

---

## 3. Endpoint ที่ใช้

### 3.1 Sections (ต่อ 1 tasklist)
```
GET {API_HOST}/task/v2/sections?resource_type=tasklist&resource_id={tasklist_guid}&page_size=100
```
> ⚠️ endpoint จริงคือ `/task/v2/sections` + **query param** (เดิมสเปกเขียน `/tasklists/{guid}/sections` = 404)
→ map `section_guid` → `section.name`

### 3.2 Tasks — **จุดที่ Genspark พัง + สเปกเดิมคลาด**
```
GET {API_HOST}/task/v2/sections/{section_guid}/tasks?page_size=100[&page_token=...]
```
> ⚠️ **task list endpoint แบบ `/tasklists/{guid}/tasks` คืน task ย่อ — ไม่มี field `tasklists`** จึงหา section ของการ์ดไม่ได้
> → เปลี่ยนเป็น **วนทุก section แล้ว list task ต่อ section** (`fetchAllTasks(sectionMap)`)
>   ได้ `section_guid` แน่นอนจาก loop + แก้ปัญหาการ์ดข้ามหลาย tasklist ในตัว (ไม่ต้องพึ่ง task.tasklists)
>   ต้อง dedup by `guid` กันการ์ดโผล่ซ้ำข้าม section
> ⚠️ `due` มาเป็น `due.timestamp` (ms) **ไม่ใช่** `due.time` (sec)

**บั๊กเดิม:** pagination หยุดก่อนครบ → บอร์ดที่มีจริง ~281 ใบ ดึงได้ ~183 ใบ ตัวเลข dashboard ผิดทั้งกระดาน

**กติกาบังคับ:** (list ต่อ section — รู้ section_guid จาก loop, ไม่พึ่ง task.tasklists)
```js
async function fetchAllTasks(sectionMap, get) {   // sectionMap: guid→name
  const out = [];
  const seen = new Set();       // dedup การ์ดข้ามหลาย section
  let pages = 0;
  for (const [sectionGuid, sectionName] of sectionMap) {
    let pageToken, hasMore;
    do {
      const body = await get(`/task/v2/sections/${sectionGuid}/tasks`, { page_size: 100, page_token: pageToken });
      const data = body.data ?? {};
      for (const item of data.items ?? []) {
        if (seen.has(item.guid)) continue;
        seen.add(item.guid);
        out.push({ ...item, _sectionGuid: sectionGuid, _sectionName: sectionName });
      }
      pageToken = data.page_token;
      hasMore = data.has_more === true;
      pages++;
      if (pages > 500) throw new Error('pagination runaway');   // กัน loop ไม่จบ
    } while (hasMore && pageToken);   // ← เงื่อนไขหยุดคือ has_more เท่านั้น
  }
  return { tasks: out, pages };
}
```
- **ห้าม** หยุดเพราะ `items.length < page_size`
- **ห้าม** หยุดเพราะได้ครบจำนวนที่คาดไว้
- log `pagesFetched` ลง `SyncRun` ทุกครั้ง เอาไว้ debug

### 3.3 Users (แปลง open_id → ชื่อ)
```
GET {host}/contact/v3/users/batch?user_id_type=open_id&user_ids=ID1&user_ids=ID2...
```
- **สูงสุด 50 id ต่อครั้ง** → chunk
- เก็บผลลง `Member` (upsert) ไม่ต้องเรียกซ้ำทุกรอบ sync — เรียกเฉพาะ open_id ที่ยังไม่มีใน DB
- `deptCode` ของ member **ไม่ได้มาจาก Lark** → default `NONE` แล้วให้ข้าว tag ในหน้า Admin (blocked-on B5)

### 3.4 Custom fields (เฟสหลัง — สำหรับ BA/UXUI/QA)
```
GET {host}/task/v2/custom_fields?resource_type=tasklist&resource_id={guid}&page_size=100
```
- `task.custom_fields[]` มากับตัวการ์ดอยู่แล้ว → เก็บดิบลง `Task.customFields` (jsonb)
- อย่าแปลง/ตีความตอน extract — แปลงตอน transform เพื่อให้เพิ่ม field ใหม่ได้โดยไม่ต้อง re-sync

---

## 4. Rate limit & error handling

| กรณี | ทำอะไร |
|---|---|
| HTTP 429 หรือ code rate limit | exponential backoff 1s → 2s → 4s → 8s (สูงสุด 5 ครั้ง) |
| `99991668` / token invalid | refresh token 1 ครั้ง แล้ว retry request เดิม 1 ครั้ง ถ้ายังพัง → FAILED + banner re-authorize |
| timeout / 5xx | retry 3 ครั้ง แล้วข้ามโปรเจกต์นั้น mark `PARTIAL` |
| tasklist ไม่เจอ / 403 | ข้าม + ขึ้นเตือนว่า "ข้าวอาจไม่ได้เป็นสมาชิกบอร์ดนี้" |

- ยิงทีละโปรเจกต์ตามลำดับ (sequential) ไม่ต้อง parallel — 3-10 โปรเจกต์ × วันละ 2 รอบ ไม่คุ้มเสี่ยงชน rate limit
- ทุก request log `{ method, path, status, ms }` แต่ **ห้าม log token หรือ secret**

---

## 5. ETL Pipeline

```
runSync(trigger)
 ├─ 1. สร้าง SyncRun (status = RUNNING)  + acquire lock (กันกดซ้อน)
 ├─ 2. ensureAccessToken()               // refresh ถ้าใกล้หมดอายุ
 ├─ 3. for each Project (isActive):
 │     ├─ EXTRACT  fetchSections(guid) + fetchAllTasks(guid)
 │     ├─ TRANSFORM
 │     │    - หา sectionName จาก sectionGuid
 │     │    - resolveSectionRule(sectionName, projectId) → { deptCode, bucketCode, weight }
 │     │    - แปลง due/completed เป็น Asia/Bangkok
 │     │    - เก็บ customFields ดิบ
 │     └─ LOAD  upsert Task by larkTaskGuid, set lastSeenAt = now
 ├─ 4. soft-delete: Task ที่ projectId นี้ และ lastSeenAt < รอบนี้ → isDeleted = true
 │                  (ห้าม hard delete — ต้องเทียบ snapshot ย้อนหลังได้)
 ├─ 5. resolveNewMembers()  // open_id ที่ยังไม่มีใน Member → /contact/v3/users/batch
 ├─ 6. recomputeProjectMetrics()  // progress %, status auto (ดู 02-PM §4-5)
 ├─ 7. refreshAutoAttentionItems()  // ดู 02-PM §7
 └─ 8. ปิด SyncRun (SUCCESS | PARTIAL | FAILED)
```

`writeSnapshot()` — รันต่อท้าย sync รอบ 17:00 เท่านั้น
```
for each Task (isDeleted = false):
    upsert TaskStateSnapshot { snapshotDate = today, larkTaskGuid, projectId, deptCode, bucketCode, sectionName }
then:
    upsert DailyAggregate สรุปเป็น count ต่อ (project, dept, bucket) + progressPct
```

---

## 6. Timezone

- DB เก็บ UTC ทั้งหมด
- **ทุกการตัดสินใจเชิงธุรกิจใช้ Asia/Bangkok** — "วันนี้", overdue, ขอบสัปดาห์, ขอบวันของ snapshot
- ใช้ `date-fns-tz` ตัวเดียว ห้ามคำนวณ offset เอง
- `overdue` = `dueAt < เที่ยงคืนวันนี้ (Asia/Bangkok)` และ `bucketCode != 'DONE'`

---

## 7. ENV ที่ต้องมี

```dotenv
# Lark — 3 host แยกกัน (ดู §1)
LARK_APP_ID=cli_aa20a1d6d338def1
LARK_APP_SECRET=
LARK_API_HOST=https://open-sg.larksuite.com/open-apis          # task/contact
LARK_AUTHORIZE_BASE=https://accounts.larksuite.com/open-apis   # หน้า login
LARK_TOKEN_BASE=https://open.larksuite.com/open-apis           # OAuth token/refresh
LARK_REDIRECT_URI=http://localhost:3000/api/auth/callback

# DB
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pmo

# App
PORT=3000
TZ=Asia/Bangkok
AUTH_MODE=dev              # dev | lark_sso
SESSION_SECRET=
SYNC_CRON_MORNING=0 8 * * *
SYNC_CRON_EVENING=0 17 * * *
```

> `.env` ห้ามขึ้น git · ส่งมอบเป็น `.env.example` ที่ไม่มีค่าจริง

---

## 8. Project seed (ไม่มีชื่อลูกค้า — ตามกติกา MASTER §1.13)

```ts
// prisma/seed.ts
const projects = [
  { projectCode: 'AUS_SILVER',   larkTasklistGuid: '4e5f2452-c3d5-4d68-8d3f-1da9c0aa538d', displayName: 'AUS_SILVER' },
  { projectCode: 'MYGOLD_BSEA',  larkTasklistGuid: 'ae094be3-95d1-4195-9e93-4149d78097c0', displayName: 'MYGOLD_BSEA' },
  { projectCode: 'LKN',          larkTasklistGuid: '73d89c8c-d920-41e0-84fa-3febc83dcc33', displayName: 'LKN' },
];
```
`displayName` ตั้งเท่ากับ code ไปก่อน — ข้าวไปแก้เป็นชื่อจริงในหน้า Admin เอง
โปรเจกต์อื่นเพิ่มผ่านหน้า Admin (blocked-on B7)

---

## 9. Test ที่ต้องมีในชั้นนี้

| test | assert |
|---|---|
| `fetchAllTasks` วนครบ | mock 3 หน้า (100/100/81) → ได้ 281 ใบ, `pages = 3` |
| `fetchAllTasks` ไม่หยุดเพราะ items สั้น | mock หน้า 1 คืน 40 ใบ + `has_more: true` → ต้องยิงหน้า 2 ต่อ |
| `fetchAllTasks` dedup ข้าม section | การ์ด guid ซ้ำ 2 section → นับครั้งเดียว + แนบ `_sectionName` |
| refresh rotation | refresh 1 ครั้ง → refreshToken ใน DB ต้องเปลี่ยน |
| refresh ล้ม | ไม่ทับ token เดิมด้วย null · `SyncRun.status = FAILED` |
| host | ทุก request ยิงไป `open-sg.larksuite.com` |
| section mapping | การ์ดที่อยู่ 2 tasklist → เลือก section ของ tasklist ที่กำลัง sync |
| soft delete | การ์ดหายจาก Lark → `isDeleted = true` ไม่ใช่ลบแถว |
| regression `AUS_SILVER` | ดู `00-MASTER.md` §10 |
