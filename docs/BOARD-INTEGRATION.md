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

### 5. Deploy — merge Main แล้วขึ้นเอง (แบบเดียวกับ PM)
- repo ต้องมี `Dockerfile` ที่ build แล้วรันได้เลย · port ตามที่ตกลง (QA = 5173)
- ข้อมูลที่ต้องรอด restart (token, ตั้งค่า) เก็บใน **โฟลเดอร์เดียว** เพื่อ mount เป็น volume (QA = `/app/config`)
- ใส่ workflow ตาม [template ข้างล่าง](#template-githubworkflowsdeployyml-สำหรับ-repo-แผนก) → PR = build + smoke test · merge เข้า Main = build + push image `ghcr.io/thanapholelegance502/<repo>:latest`
  → Watchtower บน server ดึงไปเปลี่ยนเอง ภายใน ~2–5 นาที (ดู [CICD.md](CICD.md)) — **ฝั่ง server พร้อมแล้ว ไม่ต้องตั้งอะไรเพิ่ม**
- ช่วงที่ยังไม่มี CI: build บน server เอง (ดูหัวข้อ "ติดตั้งบน server")

---

## 🔀 flow ส่งงานของทีมแผนก (ข้าวคุม branch `Main`)

```
น้องแตก branch ของตัวเอง ─► เปิด PR เข้า Main ─► CI: build + smoke test (ต้องเขียว)
        ─► ข้าวรีวิว + รีเทส ─► ข้าวกด merge ─► CI push image ─► Watchtower deploy เอง
```
- **ห้าม push เข้า `Main` ตรง ๆ** — ทุกอย่างผ่าน PR · คนกด merge = **ข้าวคนเดียว**
- ⚠️ repo แผนกเป็น **private บนบัญชีส่วนตัว (GitHub Free) → ล็อก branch ไม่ได้** (branch protection ของ private repo ต้อง GitHub Pro)
  → template กันไว้แบบฟรี: **deploy เฉพาะเมื่อคน merge/push คือข้าว** (`RELEASER`) · น้อง push Main ตรงโดยพลาด = **ไม่ deploy + CI แดงเตือน**
  → กันอุบัติเหตุได้ แต่ไม่กันคนตั้งใจแก้ workflow · ถ้าต้องการล็อกจริง: อัปเกรด GitHub Pro (~$4/เดือน) แล้วเปิด branch protection (Require PR + status check `smoke`)

### checklist รีวิว PR ของข้าว
- [ ] CI `smoke` เขียว
- [ ] ไม่มี secret ใน diff: `.env`, token, `*.pem`, `*_key`, connection string ที่มีรหัสผ่าน
- [ ] ไม่มี URL ขึ้นต้น `/` แบบ hardcode (redirect / fetch / `<script src>` / ลิงก์) — ต้องต่อ `BASE_PATH` หรือ relative
- [ ] ไม่เพิ่ม `ports:` ใน compose / ไม่เปิดแอปออกนอก nginx
- [ ] รีเทสในเครื่อง (Docker Desktop) แล้วกดดูหน้าที่แก้:
  ```bash
  git fetch origin pull/<เลข PR>/head:pr-<เลข PR> && git checkout pr-<เลข PR>
  docker build -t qa-pr . && docker run --rm -p 5173:5173 -e BASE_PATH=/qa qa-pr
  # เปิด http://localhost:5173/qa/  (ไม่มี DB/Lark ก็เปิดได้ — ข้อมูลจะว่าง)
  ```

### template `.github/workflows/deploy.yml` สำหรับ repo แผนก
ก็อบไปวางทั้งไฟล์ · ⚠️ `Dashboard_Tester` ใช้ branch ชื่อ **`Main` (M ใหญ่)** — บอร์ดอื่นแก้ `branches` + `BASE_PATH` + `APP_PORT` ให้ตรง
```yaml
# CI + Deploy — PR = build + smoke test · merge เข้า Main (โดยข้าว) = push image → Watchtower deploy เอง
name: CI + Deploy

on:
  pull_request:
    branches: [Main]
  push:
    branches: [Main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

env:
  RELEASER: thanapholelegance502   # คนเดียวที่ merge แล้ว deploy (GitHub Free ล็อก branch private ไม่ได้)
  BASE_PATH: /qa                   # path ของบอร์ดใน portal
  APP_PORT: 5173

jobs:
  # ── ด่านกั้น: image build ได้ + แอปขึ้นใต้ BASE_PATH (ไม่ต้องมี DB/Lark) ──
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t app:ci .
      - name: Run + เช็กหน้าเว็บใต้ BASE_PATH
        run: |
          docker run -d --name app -p "$APP_PORT:$APP_PORT" -e BASE_PATH="$BASE_PATH" app:ci
          for i in $(seq 1 30); do
            curl -sf -o /dev/null "http://localhost:$APP_PORT$BASE_PATH/" && exit 0
            sleep 1
          done
          echo "::error::แอปไม่ตอบที่ $BASE_PATH/ ภายใน 30 วินาที"
          exit 1
      - name: log แอป (ถ้าล้ม)
        if: failure()
        run: docker logs app || true

  # ── merge เข้า Main → build + push GHCR (Watchtower บน server ดึงไป deploy) ──
  deploy:
    needs: smoke
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Main ต้องผ่าน PR ที่ข้าว merge เท่านั้น
        if: github.actor != env.RELEASER
        run: |
          echo "::error::push เข้า Main โดย ${{ github.actor }} — ต้องเปิด PR ให้ $RELEASER merge → รอบนี้ไม่ deploy"
          exit 1
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      # image → ghcr.io/<owner>/<repo> (metadata-action แปลงเป็นตัวเล็กให้ → dashboard_tester)
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=raw,value=latest
            type=sha,format=short
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## ✅ Checklist สำหรับ repo `Dashboard_Tester` (ทีม QA)

อัปเดต 24 ก.ย. 2026 (commit `0f5738c` บน `Main`, PR #4) — รีเทสจริงแล้ว: ไฟล์นอก index/js/css ตอบ 404 · VIEWER โดน 403 ที่ endpoint ตั้งค่า/เชื่อม Lark/sync · CI push image `dashboard_tester:latest` ขึ้น GHCR แล้ว

| # | ต้องแก้ | ไฟล์ | ทำไม | สถานะ |
|---|---|---|---|---|
| 1 | redirect หลัง Lark login จาก `'/?lark_login=success'` → ต่อ `BASE_PATH` | `server.js` (callback `/api/lark/oauth/callback`) | ไม่งั้นหลังเชื่อม Lark จะเด้งออกไปหน้า Portal | ✅ |
| 2 | เพิ่ม env `DATABASE_SSL` (false = ไม่ใช้ SSL) | `server/db.js` (ตอนนี้บังคับ SSL เมื่อ host ไม่ใช่ localhost) | ไม่งั้นต่อ database `qa` ในเครื่อง portal ไม่ได้ | ✅ |
| 3 | เอา `oracle_key`, `oracle_key.pub` ออกจาก git **และออก key ใหม่** | root ของ repo | ใส่ `.gitignore` แล้ว **แต่ไฟล์ยังถูก track อยู่** (.gitignore ไม่ลบไฟล์ที่ commit ไปแล้ว) → `git rm --cached oracle_key oracle_key.pub` + สร้าง key ใหม่ + ลบ key เก่าออกจาก `~/.ssh/authorized_keys` ของเครื่องที่ใช้ key นี้ | ✅ ลบแล้ว + revoke ที่ Oracle |
| 4 | เพิ่ม `.github/workflows/deploy.yml` | ใหม่ — ก็อบ [template](#template-githubworkflowsdeployyml-สำหรับ-repo-แผนก) | merge Main แล้ว server อัพเดทเอง | 🟡 build + smoke + push GHCR ใช้ได้ · **ยังไม่มีประตู `RELEASER`** (ใคร push Main ก็ deploy) — น้องใส่เป็น TODO ไว้ |
| 5 | (แนะนำ) หน้าตั้งค่า Lark / cron ให้เฉพาะ `X-Portal-Role` = ADMIN/PM | `server.js` | กัน VIEWER ไปเปลี่ยนการเชื่อม Lark ของแอป | ✅ + แก้ช่องโหว่เสิร์ฟไฟล์ทุกไฟล์ (token หลุด) แล้ว |

ลำดับที่แนะนำ: ข้อ 3 ก่อน (ความปลอดภัย) → 4 (มี CI ไว้เช็ก PR ถัดไป) → 1 → 2 → 5 · **ทำทีละ PR** ให้ข้าวรีวิวง่าย

> ไม่ต้องรอ checklist ครบถึงจะเปิดบอร์ด QA — เฟส 1 (ใช้ Supabase เดิม) เปิดบน server ได้เลย: ข้อ 1 แค่ทำให้หลังเชื่อม Lark ในแอป QA เด้งไปหน้า portal (กดกลับ `/qa/` เอง) · ข้อ 2 จำเป็นตอนย้าย DB มาเครื่องเราเท่านั้น

---

## ติดตั้งบน server (ข้าว / คนดูแล portal)

### ครั้งแรก — บอร์ด QA (เฟส 1: DB = Supabase เดิมของทีม tester)
ต้องมีก่อน: `DATABASE_URL` (Supabase) + ค่า Lark ของแอป QA จากทีม tester
```bash
cd ~/Dashboard_PM
DC="docker compose -f docker-compose.prod.yml"

git pull                                     # เอา qa.env.example ล่าสุด

# 1) ตั้งค่าแอป QA — AppID / AppSecret / DATABASE_URL ขอจากทีม tester
cp qa.env.example qa.env && nano qa.env

# 2) เปิด profile qa (root .env) → ดึง image จาก GHCR (CI ของ repo tester push ให้แล้ว) → up
sed -i 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=caddy,qa/' .env
$DC pull qa
$DC up -d
$DC logs qa --tail 20                        # ต้องเห็น "QA dashboard running at http://localhost:5173/qa/"
```
- Lark Console: เพิ่ม redirect URI `https://elegancedb.duckdns.org/qa/api/lark/oauth/callback` (สำหรับ sync ของแอป QA)
- ตั้งค่า → ผู้ใช้: ติ๊กบอร์ด **QA** ให้ทีม tester
- เปิด `https://<domain>/qa/` ด้วยบัญชี ADMIN/PM → กดเชื่อม Lark ในแอป QA → sync
- หลังจากนี้ merge `Main` ของ repo tester → watchtower เปลี่ยน container `qa` เอง (login GHCR ชุดเดิมใช้ได้)

### อัพเดทแอป QA
- **มี CI แล้ว (checklist ข้อ 4)**: ไม่ต้องทำอะไร — ข้าว merge PR ใน `Dashboard_Tester` → Watchtower เปลี่ยนเอง (server login GHCR ไว้แล้ว ใช้ได้กับ image นี้ด้วย)
- **ยังไม่มี CI**:
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
> backup: `scripts/backup-db.sh` เก็บทุก database อัตโนมัติ — database `qa` ติดไปด้วยเอง (ดู [MAINTAINING.md](MAINTAINING.md#backup))

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
