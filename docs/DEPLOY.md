# DEPLOY — migrate ขึ้น cloud (Linux)

> stack ออกแบบให้ย้ายง่าย (Prisma + env-based config) · เอกสารนี้ = แผน ทำจริงเมื่อมีเครื่อง/domain

---

## สถาปัตยกรรม production

```
                 ┌─────────── VM Linux (Ubuntu) ───────────┐
Internet ─HTTPS─► nginx :443 ─┬─► static (web build)        │
                              └─► /api → node :3000 (pm2)   │
                                      │  node-cron 08:00/17:00
                                      ▼
                          Managed PostgreSQL (RDS/Cloud SQL)
```

---

## ขั้นตอน

### 1. Database
- **แนะนำ Managed Postgres** (AWS RDS / GCP Cloud SQL / DigitalOcean Managed DB) — backup + HA อัตโนมัติ
- ทางเลือก: Postgres ใน Docker บน VM (ต้องจัดการ backup เอง)
- ย้ายข้อมูล:
  - **เริ่มสด** (แนะนำ): `prisma migrate deploy` + `npm run seed` + authorize + sync จาก Lark ใหม่ (ข้อมูลมาจาก Lark อยู่แล้ว)
  - **ย้ายของเดิม**: `pg_dump` เครื่อง dev → `pg_restore` cloud (ถ้าต้องเก็บ snapshot/override/budget ที่กรอกไว้)

### 2. App (node)
```bash
git clone <repo> && cd Dashboard
cd server && npm ci && npx prisma migrate deploy && npm run seed
cd ../web  && npm ci && npm run build      # → web/dist (static)
```
- process manager: **pm2** (`pm2 start server/src/index.js --name pmo`) หรือ **systemd** unit
  → cron ใน process ทำงานต่อ + auto-restart เมื่อ crash/reboot

### 3. nginx + HTTPS
```nginx
server {
  listen 443 ssl;
  server_name pmo.example.com;
  # ssl_certificate ... (certbot/Let's Encrypt — ฟรี)
  root /var/www/pmo/web/dist;
  location /api/ { proxy_pass http://127.0.0.1:3000; }
  location /    { try_files $uri /index.html; }   # SPA
}
```
```bash
certbot --nginx -d pmo.example.com     # HTTPS ฟรี auto-renew
```

### 4. Auth — เปิด Lark SSO (สำคัญ 🔴)
ตอนนี้ dev-mode = **ทุกคนที่เข้าถึง = ADMIN** ต้องปิดก่อนขึ้น production:
- `.env`: `AUTH_MODE=lark_sso`
- Lark Developer Console → เพิ่ม **redirect URI** = `https://pmo.example.com/api/auth/callback` (B8 — ต้อง IT)
- whitelist ผู้ใช้ที่เข้าได้ (ตาราง `AppUser`) — ไม่พบ = ปฏิเสธ (ไม่ auto-create)
- cookie `secure=true` (https)

### 5. Env vars (production)
```dotenv
DATABASE_URL=postgresql://<user>:<pass>@<cloud-host>:5432/pmo
LARK_APP_ID=cli_aa20a1d6d338def1
LARK_APP_SECRET=<secret>              # ห้าม commit — .env server หรือ secret manager
LARK_REDIRECT_URI=https://pmo.example.com/api/auth/callback
AUTH_MODE=lark_sso
SESSION_SECRET=<random ยาว>
TZ=Asia/Bangkok
```
(3 Lark host default ถูกแล้ว — ไม่ต้องแก้)

### 6. Backup + monitoring
- `pg_dump` cron รายวัน → S3/object storage (retention 30 วัน)
- monitor `SyncRun.status=FAILED` → alert (email/Lark) — sync พังจะได้รู้
- log rotation (pm2 logrotate)

---

## Checklist ก่อน go-live
- [ ] Managed DB + connection string
- [ ] `AUTH_MODE=lark_sso` + redirect URI ลง Lark Console (IT)
- [ ] whitelist AppUser ครบ
- [ ] HTTPS (certbot)
- [ ] cookie secure=true
- [ ] `.env` ไม่อยู่ใน git · secret ปลอดภัย
- [ ] backup cron ทำงาน
- [ ] authorize Lark (ข้าว) บน server + sync รอบแรกผ่าน
- [ ] firewall เปิดเฉพาะ 443 (ปิด 3000/5432 จาก public)

---

## Docker quickstart (artifacts พร้อมแล้ว)

มีไฟล์: `server/Dockerfile` · `web/Dockerfile` (+ `web/nginx.conf`) · `docker-compose.prod.yml` · `server/.env.production.example`

```bash
cp server/.env.production.example server/.env.production   # ใส่ค่าจริง
export POSTGRES_PASSWORD=<pass>
docker compose -f docker-compose.prod.yml up -d --build     # postgres + server + web(nginx:80)

# ครั้งแรกเท่านั้น:
docker compose -f docker-compose.prod.yml exec server npm run seed
docker compose -f docker-compose.prod.yml exec server npm run lark:authorize   # ข้าว login
docker compose -f docker-compose.prod.yml exec server npm run sync:once
```
- `server` container: `prisma migrate deploy` อัตโนมัติตอน start + cron ในตัว
- `web` container: nginx serve static + proxy `/api` → server:3000
- production จริง: ต่อ reverse proxy + certbot (HTTPS) หน้า :80 หรือใช้ managed DB (ลบ service postgres)

## Harden ที่ทำแล้วใน code
- `COOKIE_SECURE` / `TRUST_PROXY` จาก env (production = https หลัง nginx)
- **SSO แยก token**: login แลก code → user_info เท่านั้น (ไม่เขียนทับ OAuth token ETL ของข้าว)
- `AUTH_MODE=lark_sso` → whitelist AppUser (ไม่พบ = 403)

## ยังต้องทำตอนมีเครื่อง/domain
- **ทดสอบ LarkSsoAuth flow จริง** (code พร้อม รอ redirect URI ลง Lark Console — B8)
- seed whitelist AppUser (ใครเข้าได้)
- certbot HTTPS + reverse proxy ชั้นนอก
- `docker build` ทดสอบจริง (เขียน Dockerfile แล้ว ยังไม่ได้ build บนเครื่องนี้)
- pg_dump backup cron
