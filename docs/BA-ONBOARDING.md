# BA-ONBOARDING — เอาบอร์ด BA ขึ้น Portal (สำหรับทีม BA)

> ส่งให้น้องทีม BA · คนดูแล portal / คนกด merge = **ข้าว (PM)**
> ฉบับเต็มของ "สัญญา" ทุกแผนก → [BOARD-INTEGRATION.md](BOARD-INTEGRATION.md) (เอกสารนี้คือเวอร์ชันย่อ เฉพาะ BA)

---

## 1. ภาพรวม — แอป BA จะอยู่ตรงไหน

```
ผู้ใช้ ─HTTPS─► https://elegancedb.duckdns.org ─► nginx ─┬─ /       → Portal (PM · การเงิน · ตั้งค่า)
                                                       ├─ /qa/    → แอปทีม QA
                                                       └─ /ba/    → [เช็กสิทธิ์บอร์ด BA] → แอปของทีม BA  ← ของเรา
                                                                                              │
                                                                  Postgres ของ portal ─ database "ba" (ของทีม BA เท่านั้น)
```

- ผู้ใช้ login ด้วย Lark **ที่ Portal ครั้งเดียว** → กดการ์ด BA → เปิด `/ba/`
- nginx เช็กสิทธิ์บอร์ด BA ให้ทุก request → **แอป BA ไม่ต้องทำหน้า login เอง**
- merge เข้า `main` (โดยข้าว) → GitHub Actions build image → server ดึงไปเปลี่ยนเองใน ~2–5 นาที (เหมือน PM / QA)

---

## 2. สิ่งที่ repo BA ต้องมี (checklist ก่อนขอเปิดบอร์ด)

| # | ต้องมี | รายละเอียด |
|---|---|---|
| 1 | repo อยู่ใต้บัญชี **`thanapholelegance502`** (private ได้) | image จะเป็น `ghcr.io/thanapholelegance502/<ชื่อ repo ตัวเล็ก>` — server login GHCR บัญชีนี้ไว้แล้ว ถ้า repo อยู่บัญชีอื่น server ดึง image ไม่ได้ |
| 2 | `Dockerfile` ที่ build แล้วรันได้เลย | ไม่ต้องมี DB / Lark ก็ต้อง **start ขึ้นและตอบหน้าแรกได้** (CI เช็กแบบนี้) |
| 3 | รันใต้ path `/ba` ได้ (`BASE_PATH`) | ดูข้อ 3 |
| 4 | port เดียว ผ่าน env `PORT` (ตกลงใช้ **8080**) | ถ้าจะใช้เลขอื่น บอกข้าวก่อน (ต้องแก้ compose + nginx ฝั่ง portal) |
| 5 | ตัวตนผู้ใช้อ่านจาก header | ดูข้อ 4 |
| 6 | DB ผ่าน `DATABASE_URL` + `DATABASE_SSL` | ดูข้อ 5 |
| 7 | ไฟล์ที่ต้องรอด restart เก็บใน **โฟลเดอร์เดียว** เช่น `/app/config` | server จะ mount เป็น volume (token Lark, ไฟล์ตั้งค่า) — ที่อื่นในคอนเทนเนอร์หายทุก deploy |
| 8 | `.gitignore` มี `.env`, `*.pem`, `*_key`, `node_modules/`, `config/` ตั้งแต่วันแรก | secret ห้ามขึ้น git — **เคย commit ไปแล้ว = ต้องออก key ใหม่** (ลบไฟล์ไม่พอ ยังอยู่ใน history) |
| 9 | `.env.example` (ชื่อตัวแปรครบ ค่าว่าง) | ข้าวใช้ตั้ง `ba.env` บน server |
| 10 | `.github/workflows/deploy.yml` | ก็อบจากข้อ 7 ทั้งไฟล์ |

---

## 3. อยู่ใต้ `/ba` (สำคัญ — พลาดบ่อยสุด)

- nginx ส่ง **path เต็ม** มาให้ เช่น `/ba/api/requirements` → แอปต้องตัด prefix `BASE_PATH` เอง (หรือ mount router ไว้ใต้ `/ba`)
- **ห้ามมี URL ขึ้นต้นด้วย `/` แบบ hardcode** ทั้ง `fetch('/api/…')`, `redirect('/')`, `<script src="/app.js">`, ลิงก์เมนู
  → ต้องต่อ `BASE_PATH` หรือใช้ path แบบ relative (`api/…`, `./app.js`) · ไม่งั้นจะเด้งออกไปหน้า Portal
- ถ้าใช้ Vite/React: ตั้ง `base: '/ba/'` ใน `vite.config` · ถ้าใช้ React Router: `basename="/ba"`
- ทดสอบในเครื่อง: เปิด `http://localhost:8080/ba/` แล้วกดทุกเมนู/ทุกปุ่ม — URL ต้องยังขึ้นต้น `/ba/` ตลอด

---

## 4. ใครใช้งานอยู่ — อ่านจาก header (ไม่ต้องทำ login)

request ที่มาถึงแอป = ผ่านการเช็กสิทธิ์บอร์ด BA แล้วเสมอ · nginx แนบ header ให้:

| header | ตัวอย่าง | ใช้ทำอะไร |
|---|---|---|
| `X-Portal-User` | `name@elegance.co.th` | รู้ว่าใครดู / ใครแก้ → **เก็บลง log การแก้ไขทุกครั้ง** (ใคร · เมื่อไร · แก้อะไร) |
| `X-Portal-Role` | `ADMIN` / `PM` / `VIEWER` | ปุ่ม/หน้า ที่แก้ค่าระบบ (ตั้งค่า Lark, cron, ลบข้อมูล) → ให้เฉพาะ `ADMIN` หรือ `PM` · VIEWER ดูอย่างเดียว |

- เชื่อ header นี้ได้ **เพราะแอปเข้าได้ทาง nginx เท่านั้น** → ใน compose ฝั่ง server ใช้ `expose` ไม่เปิด port ออกนอกเครื่อง
- ตอน dev ในเครื่อง (ไม่มี nginx): ใส่ค่า default เองได้ เช่น ไม่มี header → ถือเป็น `dev@local` / `ADMIN` **เฉพาะตอน `NODE_ENV!=production`**

---

## 5. Database — เป็นยังไง

**สรุป:** ทีม BA ได้ **database ชื่อ `ba` + user `ba_app` ของตัวเอง** อยู่ใน Postgres ตัวเดียวกับ Portal (บน server) · ไม่แชร์ตารางกับใคร · ไม่ต้องใช้ Supabase/DB ข้างนอก

| เรื่อง | รายละเอียด |
|---|---|
| ใครสร้าง | **ข้าว** รัน `bash scripts/create-board-db.sh ba` บน server → ได้ user `ba_app` + database `ba` (ba_app เป็นเจ้าของ) |
| connection string (บน server) | `DATABASE_URL=postgresql://ba_app:<รหัส>@postgres:5432/ba` · รหัสข้าวใส่ใน `ba.env` บน server เอง — **ทีม BA ไม่ต้องรู้รหัส production** |
| SSL | Postgres ใน docker **ไม่มี SSL** → โค้ดต้องปิดได้ด้วย `DATABASE_SSL=false` (อย่าบังคับ SSL ตาม host) |
| สร้างตาราง | **ทีม BA จัดการเอง** ตอนแอป start — `CREATE TABLE IF NOT EXISTS` หรือ migration tool (Prisma / Knex / node-pg-migrate) · ต้องรันซ้ำได้ไม่พัง · Portal ไม่สร้างตารางให้ |
| แก้ schema ทีหลัง | ทำเป็น migration ใหม่ (เพิ่มคอลัมน์ / ตาราง) · **ห้าม DROP/ล้างตารางตอน start** — ข้อมูลจริงอยู่ในนั้น |
| สิทธิ์ | `ba_app` เข้าได้แค่ database `ba` — **เข้า database `pmo` (ข้อมูลโปรเจกต์/การเงิน) ไม่ได้** โดยตั้งใจ |
| backup | server backup ทุก database อัตโนมัติทุกวัน — `ba` ติดไปด้วย ไม่ต้องทำเพิ่ม |
| คนเขียน DB | **แอป BA บน server ตัวเดียว** — ห้ามเอา DB production ไปต่อจากเครื่อง dev (ทีม QA เคยมี 2 instance เขียน DB เดียวกันแล้วข้อมูลตีกัน) |
| ข้อมูลจาก Lark ที่ PM sync อยู่แล้ว | ยังไม่มี API กลาง (เฟส 2) → **อย่าต่อ DB `pmo` ตรง** · ถ้าต้องใช้ข้อมูล Lark ให้แอป BA sync เอง (ข้อ 6) |

**dev ในเครื่อง** — ใช้ Postgres ของตัวเอง (ข้อมูลตัวอย่าง ไม่ใช่ข้อมูลจริง):
```bash
docker run -d --name ba-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=ba postgres:16-alpine
# .env ในเครื่อง
DATABASE_URL=postgresql://postgres:dev@localhost:5432/ba
DATABASE_SSL=false
```

---

## 6. Lark (ถ้าแอป BA ต้องดึงข้อมูลจาก Lark เอง)

- สร้าง **Lark app ของทีม BA เอง** (แยกจาก PM / QA) → ได้ App ID / App Secret
- redirect URI ที่ต้องลงใน Lark Console (ให้ตรงกับ path callback ในโค้ด) เช่น
  `https://elegancedb.duckdns.org/ba/api/lark/oauth/callback`
- App ID / Secret → **ส่งให้ข้าวทางแชทส่วนตัว** (ไม่ใส่ใน git / issue / PR) — ข้าวใส่ใน `ba.env` บน server
- token ที่ได้หลัง authorize → เก็บในโฟลเดอร์ config (checklist ข้อ 7) หรือใน DB `ba` · refresh token ของ Lark หมุนทุกครั้งที่ใช้ → ต้องเขียนทับค่าใหม่ทันที
- ข้อมูลใน repo / seed / test: **ห้ามมีชื่อลูกค้าจริง** — ใช้รหัสโปรเจกต์ (project_code) หรือชื่อสมมติ

---

## 7. ส่งงานยังไง — ห้าม push `main` ตรง

```
แตก branch ของตัวเอง ─► เปิด PR เข้า main ─► CI "smoke" ต้องเขียว
   ─► ข้าวรีวิว + รีเทส ─► ข้าวกด merge ─► CI push image ─► server deploy เอง (~2–5 นาที)
```
- ทุกอย่างผ่าน **PR** · คนกด merge = **ข้าวคนเดียว** · merge = ขึ้นให้ผู้บริหารดูทันที
- PR เล็ก ๆ ทีละเรื่อง รีวิวง่าย ขึ้นเร็ว
- repo private บน GitHub Free ล็อก branch ไม่ได้ → workflow ข้างล่างกันไว้: **deploy เฉพาะเมื่อคน merge คือข้าว** · ถ้าเผลอ push main ตรง = ไม่ deploy + CI แดงเตือน (ให้เปิด PR ใหม่)

### `.github/workflows/deploy.yml` (ก็อบทั้งไฟล์ — ตั้งค่า BA ไว้แล้ว)
> ถ้า branch หลักของ repo ชื่อ `Main` (M ใหญ่) ให้แก้ `branches` 2 ที่ · ถ้าเปลี่ยน port แก้ `APP_PORT`
```yaml
# CI + Deploy — PR = build + smoke test · merge เข้า main (โดยข้าว) = push image → server deploy เอง
name: CI + Deploy

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

env:
  RELEASER: thanapholelegance502   # คนเดียวที่ merge แล้ว deploy
  BASE_PATH: /ba                   # path ของบอร์ดใน portal
  APP_PORT: 8080

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
          docker run -d --name app -p "$APP_PORT:$APP_PORT" -e BASE_PATH="$BASE_PATH" -e PORT="$APP_PORT" app:ci
          for i in $(seq 1 30); do
            curl -sf -o /dev/null "http://localhost:$APP_PORT$BASE_PATH/" && exit 0
            sleep 1
          done
          echo "::error::แอปไม่ตอบที่ $BASE_PATH/ ภายใน 30 วินาที"
          exit 1
      - name: log แอป (ถ้าล้ม)
        if: failure()
        run: docker logs app || true

  # ── merge เข้า main → build + push GHCR (server ดึงไป deploy) ──
  deploy:
    needs: smoke
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: main ต้องผ่าน PR ที่ข้าว merge เท่านั้น
        if: github.actor != env.RELEASER
        run: |
          echo "::error::push เข้า main โดย ${{ github.actor }} — ต้องเปิด PR ให้ $RELEASER merge → รอบนี้ไม่ deploy"
          exit 1
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
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

### ก่อนกด "Create pull request" เช็กเอง
- [ ] `docker build -t ba . && docker run --rm -p 8080:8080 -e BASE_PATH=/ba ba` → เปิด `http://localhost:8080/ba/` ได้ กดทุกเมนูไม่เด้งออกนอก `/ba/`
- [ ] diff ไม่มี `.env`, token, key, connection string ที่มีรหัสผ่าน, ชื่อลูกค้าจริง
- [ ] ไม่มี `fetch('/…')` / `redirect('/…')` / `src="/…"` แบบ hardcode
- [ ] แก้ schema = มี migration ใหม่ ไม่ได้แก้/ลบของเดิม
- [ ] คำอธิบาย PR: ทำอะไร · ทดสอบยังไง · มี env ตัวใหม่ไหม (ถ้ามี ข้าวต้องเพิ่มใน `ba.env` ก่อน merge)

---

## 8. สิ่งที่ต้องส่งให้ข้าว (ครั้งแรก ก่อนเปิดบอร์ด)

1. ชื่อ repo (อยู่ใต้ `thanapholelegance502`) + ชื่อ branch หลัก (`main` หรือ `Main`)
2. port (ถ้าไม่ใช่ 8080) + path โฟลเดอร์ config ที่ต้อง mount (เช่น `/app/config`)
3. `.env.example` — รายชื่อ env ทั้งหมดที่แอปใช้
4. Lark App ID / Secret (ถ้ามี) — **ทางแชทส่วนตัวเท่านั้น**
5. รายชื่อคนในทีม BA ที่ต้องเข้าบอร์ด (อีเมล Lark) — ข้าวติ๊กสิทธิ์บอร์ด BA ให้ที่ ตั้งค่า → ผู้ใช้

---

## ภาคผนวก — ฝั่ง server (ข้าวทำ ครั้งเดียว)

ทำเมื่อ repo BA มี Dockerfile + CI push image แล้ว (รายละเอียดเต็ม: [BOARD-INTEGRATION.md → เพิ่มบอร์ดแผนกใหม่](BOARD-INTEGRATION.md#เพิ่มบอร์ดแผนกใหม่-เช่น-ba-c-level-เมื่อ-repo-มีแอปแล้ว))

1. **PR ใน Dashboard_PM** — ✅ ทำแล้ว (boards.js · nginx `/ba/` · compose service `ba` · `ba.env.example`):
   - `server/src/domain/boards.js` — BA: `kind: 'external'`, `path: '/ba/'`
   - `web/nginx.conf` — ก็อบบล็อก `/_auth/qa` + `/qa/` → `ba` (board=BA, upstream `http://ba:8080`)
   - `docker-compose.prod.yml` — ก็อบ service `qa` → `ba` (profile `ba`, image `ghcr.io/thanapholelegance502/<repo ba>:latest`, `env_file: ./ba.env`, `expose: 8080`, volume `ba_config:/app/config`, label watchtower)
   - `ba.env.example`
2. บน server:
   ```bash
   cd ~/Dashboard_PM && git pull
   bash scripts/create-board-db.sh ba          # จด DATABASE_URL ที่ได้
   cp ba.env.example ba.env && nano ba.env     # NODE_ENV=production (ห้ามว่าง) · DATABASE_URL · ค่า Lark
   sed -i 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=caddy,qa,ba/' .env
   DC="docker compose -f docker-compose.prod.yml"
   $DC pull ba && $DC up -d && $DC logs ba --tail 20
   ```
3. นำข้อมูลเดิมเข้า **ก่อน** sync จริงรอบแรก (ไฟล์จากทีม BA — มีชื่อจริง ห้ามขึ้น git):
   ```bash
   $DC exec ba mkdir -p /app/config/import
   for f in *.json; do $DC cp "$f" ba:/app/config/import/; done   # snapshot 3 ไฟล์ + options.json
   $DC exec ba node server/scripts/import-snapshots.js
   ```
4. ตั้งค่า → ผู้ใช้: ติ๊กบอร์ด **BA** ให้ทีม · เปิด `/ba/admin` → กด "กวาด Task ใหม่" 1 ครั้ง
5. หลังจากนี้: ข้าว merge PR ใน repo BA → Watchtower เปลี่ยน container `ba` เอง
