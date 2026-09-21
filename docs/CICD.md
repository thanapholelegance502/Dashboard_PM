# CI/CD — Auto-deploy (merge main → server อัพเดทเอง)

> เป้าหมาย: น้อง push → ข้าวรีวิว → **merge เข้า main → server อัพเดทเองภายในไม่กี่นาที**
> ไม่ต้อง SSH เข้า server แก้อะไรอีกเลย

## ภาพรวม flow

```
น้อง push branch ──► PR ──► ข้าวรีวิว + merge main
                                    │
                                    ▼
              GitHub Actions (.github/workflows/deploy.yml)
                1. รัน unit tests (ด่านกั้น — test ไม่ผ่าน = ไม่ deploy)
                2. build image: server + web
                3. push → GHCR (ghcr.io/thanapholelegance502/dashboard_pm-{server,web})
                                    │  (server ดึงเอง — outbound เท่านั้น)
                                    ▼
              Watchtower บน server (poll GHCR ทุก 120 วิ)
                เห็น image ใหม่ → ดึง → เปลี่ยน container → migrate อัตโนมัติ
```

**ทำไมเป็นแบบ pull (server ดึงเอง) ไม่ใช่ push (CI ยิงเข้า server):**
provider ยังไม่เปิด port เข้า server (inbound) → CI ยิงเข้ามาไม่ได้
Watchtower ใช้แค่ outbound (server → GHCR) ที่เปิดอยู่แล้ว → **ใช้ได้เลยตอนนี้**

## สิ่งที่ auto ให้แล้ว
- ✅ Test เป็นด่านกั้น — merge โค้ดที่ test ไม่ผ่าน จะไม่ถูก deploy (ของบน server ไม่ล่ม)
- ✅ `prisma migrate deploy` รันเองตอน container start (มีอยู่ใน `server/Dockerfile` แล้ว)
- ✅ `.env.production` + Lark OAuth token **ไม่หาย** — env อยู่บน host, token อยู่ใน DB (volume `pgdata`); watchtower เปลี่ยน container โดยคงค่าเดิม
- ✅ image เก่าถูกลบอัตโนมัติ (`WATCHTOWER_CLEANUP`) — กันดิสก์เต็ม

---

## ⚙️ ตั้งค่าครั้งเดียว (one-time)

### 1. บน GitHub — เปิดสิทธิ์ให้ Actions push image
Repo → **Settings → Actions → General → Workflow permissions**
→ เลือก **Read and write permissions** → Save
(workflow ใช้ `GITHUB_TOKEN` push เข้า GHCR — ต้องมีสิทธิ์ write packages)

> ไม่ต้องสร้าง secret เพิ่ม — `GITHUB_TOKEN` มีให้อัตโนมัติ

### 2. สร้าง PAT สำหรับ server ดึง image (read-only)
image เป็น **private** (source อยู่ในนั้น) → server ต้อง login ก่อนดึง
- GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic)**
- **Generate new token** → ติ๊กสิทธิ์ **`read:packages`** อย่างเดียว → คัดลอก token ไว้
- (fine-grained token ก็ได้ ถ้าถนัด: ให้สิทธิ์ Packages: Read-only)

### 3. บน server — login GHCR ครั้งเดียว
```bash
echo <PAT ที่คัดจากข้อ 2> | docker login ghcr.io -u thanapholelegance502 --password-stdin
```
→ สร้าง `~/.docker/config.json` ที่ watchtower เอาไปใช้ดึง image private

> ถ้ารัน docker ด้วย sudo/root: config อยู่ที่ `/root/.docker/config.json`
> (compose default mount จากที่นี่ — ปรับได้ด้วย env `DOCKER_CONFIG_DIR`)

### 4. บน server — deploy รอบแรก (สลับมาใช้ image แทน build)
```bash
cd Dashboard_PM
git pull                                    # เอา compose + watchtower ล่าสุด
export POSTGRES_PASSWORD=<pass เดิม>
bash deploy.sh                              # pull image + up (มี watchtower)
```
> รอบแรกต้องรอ GitHub Actions build image เสร็จก่อน (ดู tab **Actions** บน GitHub)
> ครั้งต่อ ๆ ไป **ไม่ต้องทำอะไรบน server อีก** — merge main พอ

### 5. ตรวจว่า watchtower ทำงาน
```bash
docker compose -f docker-compose.prod.yml logs -f watchtower
```
เห็น `Checking all containers...` = โอเค · เวลามี image ใหม่จะขึ้น `Found new ... image`

---

## หลัง merge main แล้วเกิดอะไร (timeline)
1. GitHub Actions รัน (~2–4 นาที): test → build → push
2. Watchtower เช็ครอบถัดไป (≤120 วิ) เห็น image ใหม่
3. ดึง image → หยุด container เก่า → start ใหม่ (server รัน migrate เอง)
4. เว็บอัพเดท — รวม ~3–6 นาทีหลัง merge

## อยาก deploy ทันที (ไม่รอ poll)
```bash
docker compose -f docker-compose.prod.yml exec watchtower /watchtower --run-once
# หรือ pull เอง:
bash deploy.sh
```

## ปรับความถี่ poll
`.env` (root) ของ server:
```dotenv
WATCHTOWER_POLL_INTERVAL=300   # เช็คทุก 5 นาที (default 120)
```

---

## Troubleshooting
| อาการ | สาเหตุ / แก้ |
|---|---|
| Actions ล้มที่ step "Build + push" (403) | ยังไม่เปิด write permission (ข้อ 1) |
| watchtower log `manifest unknown` / `denied` | server ยัง login ghcr.io ไม่ผ่าน (ข้อ 2–3) หรือ PAT หมดสิทธิ์ |
| merge แล้ว test ไม่ผ่าน → ไม่ deploy | ✅ ทำงานถูกแล้ว — ดู log ใน Actions ว่า test อะไรพัง |
| อยาก rollback | `IMAGE_TAG=sha-<commit>` ใน `.env` แล้ว `bash deploy.sh` (CI tag ทุก build ด้วย sha) |
| container ใหม่พัง อยากดู | `docker compose -f docker-compose.prod.yml logs -f server` |

## หมายเหตุด้าน test ใน CI
CI รัน `npm run test:ci` = 51 unit tests (ยกเว้น `pm-api.test.js` ตัวเดียว)
เพราะ `pm-api.test.js` เป็น integration test ที่ต้องมี DB **ที่ sync ข้อมูลจริงจาก Lark** (assert `AUS_SILVER = 132 ใบ`) — รันใน CI ไม่ได้ (ไม่มี Lark credential + ข้อมูลจริง)
บนเครื่อง dev/server ที่มีข้อมูลจริง ยังรัน `npm test` ครบ 56 tests เหมือนเดิม
