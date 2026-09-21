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

## 🚀 Deploy จริงรอบแรก — Ubuntu + Docker + IP + dev-mode (ไม่มี domain)

> scenario ปัจจุบัน: server Ubuntu มี Docker · เข้าผ่าน IP · dev-mode หลัง firewall/VPN
> ⚠️ dev-mode = ทุกคนที่เข้าถึง IP:80 เป็น ADMIN → **firewall ต้องเปิด :80 เฉพาะ IP/VPN ที่เชื่อถือ**

### 1) บน server — clone + ติดตั้ง Docker (ถ้ายังไม่มี)
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER && newgrp docker      # ใช้ docker ไม่ต้อง sudo
git clone https://github.com/thanapholelegance502/Dashboard_PM.git
cd Dashboard_PM
```

### 2) สร้าง .env.production (dev-mode)
```bash
cp server/.env.production.example server/.env.production
nano server/.env.production
```
ตั้งค่า (รอบนี้ dev-mode + http):
```dotenv
NODE_ENV=production
LARK_APP_ID=cli_aa20a1d6d338def1
LARK_APP_SECRET=<secret จริง>
LARK_REDIRECT_URI=http://localhost:3000/api/auth/callback   # authorize ผ่าน SSH tunnel
DATABASE_URL=postgresql://postgres:<pass>@postgres:5432/pmo
AUTH_MODE=dev              # รอบนี้ dev · เปลี่ยนเป็น lark_sso เมื่อมี domain
COOKIE_SECURE=false        # ยังเป็น http
TRUST_PROXY=true
SESSION_SECRET=<random>
TZ=Asia/Bangkok
```

### 3) ขึ้น stack
```bash
export POSTGRES_PASSWORD=<pass เดียวกับใน DATABASE_URL>
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec server npm run seed
```

### 4) Authorize Lark (ครั้งเดียว — ผ่าน SSH tunnel)
temp authorize server ฟังที่ container :3000 (publish เฉพาะ localhost ของ server)
```bash
# บนเครื่องคุณ (local) — เปิด tunnel:
ssh -L 3000:localhost:3000 <user>@<server-ip>

# ใน SSH session (บน server):
docker compose -f docker-compose.prod.yml exec server npm run lark:authorize
# → print URL · เปิด URL นั้นใน browser เครื่อง local → login Lark + กดอนุญาต
# callback http://localhost:3000/... วิ่งผ่าน tunnel เข้า server → token เขียนลง DB
```
> Lark Console มี redirect URI `http://localhost:3000/api/auth/callback` อยู่แล้ว (จาก dev local) — ใช้ซ้ำได้

### 5) ดึงข้อมูล + เข้าใช้
```bash
docker compose -f docker-compose.prod.yml exec server npm run sync:once -- --snapshot
```
เปิด **`http://<server-ip>`** (web nginx :80)

### 6) Firewall (สำคัญ — dev-mode)
```bash
sudo ufw allow from <trusted-ip-หรือ-subnet> to any port 80
sudo ufw enable
# ห้ามเปิด :80 ให้ 0.0.0.0 (public) เพราะ dev-mode = ADMIN ทุกคน
```

### ต่อไป (เมื่อมี domain)
→ ทำ HTTPS (certbot) + `AUTH_MODE=lark_sso` + `COOKIE_SECURE=true` + ลง redirect URI domain ใน Lark Console (ดูหัวข้อล่าง)

---

## Docker quickstart (อ้างอิง)

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
