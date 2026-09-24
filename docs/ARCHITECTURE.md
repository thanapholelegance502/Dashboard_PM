# ARCHITECTURE — โครงโค้ด, data model, API, Lark

---

## Data flow

```
Lark Task API ─► extract ─► transform ─► load ─► PostgreSQL ─► API ─► React
                (section+     (map rule:   (upsert    (Task, Snapshot,
                 task ต่อ      section→      + soft-    DailyAggregate,
                 section)      dept/bucket/  delete)    Project, budget…)
                              weight)
                                              │
                              snapshot 17:00 ─┘─► TaskStateSnapshot + DailyAggregate
```

---

## โครงโค้ด backend (`server/src/`)

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `config/env.js` | env ทั้งหมด (3 Lark host, DB, auth mode) |
| `lark/` | `client.js` (axios + backoff) · `auth.js` (OAuth + refresh rotation) · `tasks.js` (section/task pagination) · `contacts.js` (users batch) |
| `etl/` | `extract · transform · load · snapshot · members · runSync · postprocess` |
| `domain/` | **pure logic (testได้)**: `bucket.js` (rule engine) · `progress.js` · `status.js` · `metrics.js` · `attention.js` · `time.js` · `audit.js` · `enums.js` |
| `api/routes/` | `pm.js` · `admin.js` · `auth.js` · `sync.js` · `meta.js` |
| `jobs/cron.js` | cron 08:00/17:00 |
| `db/prisma.js` | Prisma singleton |

## โครงโค้ด frontend (`web/src/`)

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `lib/` | `api.ts` · `types.ts` · `theme.ts` (สี §11) · `format.ts` |
| `components/` | KpiCard · StatusBadge · DonutChart · TrendLine · GanttTimeline · FilterBar · DrillDownPanel |
| `pages/` | `PM.tsx` · `Admin.tsx` · `Finance.tsx` |

---

## Data model (Prisma — หลัก)

- **Project** — projectCode, larkTasklistGuid, target/actual UAT+Go-Live (forecast ตัดออก 24 ก.ย. — column ยังอยู่แต่ไม่ใช้), status/progress override, **budget**
- **Task** — larkTaskGuid, sectionName, **deptCode/bucketCode/sectionWeight** (คำนวณจาก rule), dueAt, assignee, soft-delete
- **SectionRule** — matchType/pattern/deptCode/bucketCode/weight/priority/projectId (map section → dept/bucket/weight, แก้ผ่าน Admin)
- **PaymentInstallment** — งวดการเงิน (name/amount/dueDate/status)
- **TaskStateSnapshot / DailyAggregate** — ประวัติรายวัน (trend, as-of)
- **AttentionItem** — CEO decision (MANUAL + AUTO)
- **Member · AppUser · OAuthToken · SyncRun · AuditLog**

`bucket_code`: BACKLOG · IN_PROGRESS · WAITING · DONE · BLOCKED
`dept_code`: PM · BA · UXUI · DEV · QA · NONE

---

## API

```
GET  /api/pm/portfolio?status=&projectCode=&asOf=   # KPI + projects
GET  /api/pm/milestones?days=14
GET  /api/pm/trend?weeks=12
GET  /api/pm/attention?status=OPEN
GET  /api/pm/projects/:code/tasks?dept=&bucket=&overdue=   # drill-down
GET  /api/pm/projects/:code/budget                          # งวดการเงิน
GET  /api/pm/finance                                        # C-level รวม
POST /api/sync/run · /api/sync/snapshot
CRUD /api/admin/projects · /section-rules · /installments · /members · /attention-items
POST /api/admin/projects/:code/{status,progress}-override · /test-connection
POST /api/admin/recompute                                   # apply rule กับ task (ไม่ยิง Lark)
GET  /api/meta/projects · /members · /sections · /unmapped-sections
```

---

## ⚠️ สิ่งที่เรียนรู้จาก Lark (กับดักที่เจอจริง)

**3 host แยกกัน — ห้ามใช้ open-sg ยิงทุกอย่าง:**
| งาน | host |
|---|---|
| task / contact API | `open-sg.larksuite.com` (tenant SG) |
| OAuth authorize (หน้า login) | `accounts.larksuite.com` · param = `client_id` |
| OAuth token / refresh | `open.larksuite.com` |

- sections: `GET /task/v2/sections?resource_type=tasklist&resource_id={guid}` (query param) — **ไม่ใช่** `/tasklists/{guid}/sections` (404)
- task list endpoint คืน task **ย่อ ไม่มี field tasklists** → ต้อง list ต่อ section (`/task/v2/sections/{sec}/tasks`) แล้ว dedup
- `due` = `due.timestamp` (ms) ไม่ใช่ `due.time` (sec)
- refresh token **หมุนทุกครั้ง** → เขียนทับทันทีในทรานแซกชันเดียว มิฉะนั้นระบบตายถาวร
- ข้าวต้องเป็นสมาชิกทุก tasklist ที่จะดึง (ไม่งั้น 403/ว่าง)

**การ map section:** แต่ละบอร์ดตั้งชื่อ section คนละแบบ (space/emoji/ไทย) → เก็บเป็น `SectionRule` per-project ใน DB แก้ผ่านหน้า Admin (ไม่ hardcode)
