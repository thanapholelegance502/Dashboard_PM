# POC Deploy — VPS (Vultr) + DuckDNS + Caddy + Lark SSO

> hosting ชั่วคราวช่วง POC ไม่ใช้ domain/resource บริษัท · HTTPS จริง + SSO จริง
> **ใช้งานจริงอยู่ที่ `https://elegancedb.duckdns.org`** (Vultr, Ubuntu 22.04)
> ออกแบบให้ **ย้ายเข้า staging + domain บริษัท ได้ง่าย** → ดู [MIGRATION-POC-TO-STAGING.md](MIGRATION-POC-TO-STAGING.md)

```
Internet ─HTTPS─► Caddy (:443, Let's Encrypt) ─► web:80 (nginx) ─► server:3000
                                                        └─► /qa/ → qa (บอร์ด QA, ต้องผ่านสิทธิ์)
DuckDNS: <sub>.duckdns.org → public IP ของ VPS
```

## ทำไมชุดนี้
- **VPS ทั่วไป (Vultr)** = เราคุม firewall/port เอง (ปัญหาเดิม: provider เปิด port ผิด เครื่อง down) · Oracle Free เต็ม, AWS/GCP ต้องผูกบัตร
- **DuckDNS** = subdomain ฟรี URL คงที่ (ต่างจาก Cloudflare Quick Tunnel ที่ URL เปลี่ยนทุก restart)
- **Caddy** = HTTPS ฟรีจาก Let's Encrypt auto-renew (DuckDNS ใช้กับ Cloudflare Tunnel ไม่ได้ เพราะ domain ต้องอยู่บน Cloudflare)

---

## ตั้งค่าครั้งเดียว

### 1) VPS
- Ubuntu 22.04 · RAM 1–2 GB พอ (มี swap)
- เปิด port **22 / 80 / 443** เท่านั้น (3000/5432 ไม่ต้อง — อยู่ใน docker network) → คำสั่ง ufw ดู [MAINTAINING.md → H-3](MAINTAINING.md#h-3--ปิด-port--ssh-ใช้-key-อย่างเดียว)
- swap 2 GB (กัน build/npm install โดน OOM บนเครื่อง RAM น้อย):
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

### 2) DuckDNS
- [duckdns.org](https://www.duckdns.org) → login → สร้าง subdomain (เช่น `elegancedb`)
- ตั้ง **current ip** = public IP ของ VPS → ได้ `<sub>.duckdns.org`
- เช็ก: `getent hosts <sub>.duckdns.org` ต้องได้ IP ของ VPS

### 3) Lark Console
- Security Settings → Redirect URLs เพิ่ม: `https://<sub>.duckdns.org/api/auth/callback`
  (ต้องตรงกับ `LARK_REDIRECT_URI` ทุกตัวอักษร — ไม่ตรง = error **20029**)

### 4) Deploy บน VPS
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/thanapholelegance502/Dashboard_PM.git && cd Dashboard_PM

# .env.production (backend)
cp server/.env.production.poc.example server/.env.production
nano server/.env.production   # LARK_APP_SECRET, SESSION_SECRET, DB pass, LARK_REDIRECT_URI, APP_ADMINS

# root .env (compose) — ingress = caddy + domain
cat > .env <<EOF
POSTGRES_PASSWORD=<pass เดียวกับใน DATABASE_URL>
COMPOSE_PROFILES=caddy
PUBLIC_DOMAIN=<sub>.duckdns.org
ACME_EMAIL=<อีเมลรับแจ้งเตือน cert>
EOF
```
> ⚠️ `PUBLIC_DOMAIN` ใส่แค่ชื่อ host — **ห้ามมี `https://`** ไม่งั้น Caddy ขอ cert ไม่ได้

**ได้ image มาจากไหน** — เลือกทางเดียว:
```bash
DC="docker compose -f docker-compose.prod.yml"

# ก) ดึงจาก GHCR (หลัง CI build บน main แล้ว — ดู docs/CICD.md)
echo <GHCR_PAT> | docker login ghcr.io -u thanapholelegance502 --password-stdin
$DC pull

# ข) build บนเครื่องเอง (ยังไม่มี image บน GHCR / ไม่อยาก login)
docker build -t ghcr.io/thanapholelegance502/dashboard_pm-server:latest ./server
docker build -t ghcr.io/thanapholelegance502/dashboard_pm-web:latest ./web

$DC up -d --scale watchtower=0   # watchtower ปิดไว้จนกว่าจะ login GHCR แล้ว (ไม่งั้นมันพยายาม pull แล้ว error)
```

### 5) ครั้งแรก — seed + whitelist + เชื่อม Lark + sync
```bash
$DC exec -T server npm run seed              # section rules + projects
$DC exec -T server npm run seed:appusers     # whitelist จาก APP_ADMINS/APP_PMS/APP_VIEWERS
```
1. เปิด `https://<sub>.duckdns.org` → login Lark ด้วยบัญชีที่อยู่ใน `APP_ADMINS`
2. **ตั้งค่า (Admin) → ปุ่ม "เชื่อม Lark ใหม่"** → login/อนุญาตด้วยบัญชีที่เป็นสมาชิกทุกบอร์ด (ข้าว) → กลับมาเห็น "เชื่อม Lark สำเร็จ"
3. Dashboard → **Sync now** (หรือ `$DC exec server npm run sync:once -- --snapshot`)

> ทางสำรอง (ไม่มีหน้าเว็บ): `$DC exec server npm run lark:authorize` → เปิด URL → หน้า callback จะโชว์คำสั่ง `--code …` ให้ก็อบไปรันภายใน ~1 นาที
> ไม่ต้องสลับ `AUTH_MODE=dev` แล้ว (callback แยก flow ตาม `state` — `server/src/domain/oauthState.js`)

### 6) ทดสอบ
- เปิด `https://<sub>.duckdns.org` → Login → Lark → กลับมาหน้าเลือกบอร์ด
- คนที่ไม่อยู่ whitelist → หน้า 🚫 ไม่พบสิทธิ์ (ถูกต้อง) → ADMIN เพิ่มได้ที่ ตั้งค่า → แท็บ "ผู้ใช้"
- `$DC restart server` แล้ว refresh → **ยัง login อยู่** (session เก็บใน Postgres)
- cert: กุญแจใน browser · ไม่ออก → `$DC logs -f caddy`

### 7) Backup + ปิด port
ตั้ง cron backup + ปิด port/SSH password → [MAINTAINING.md](MAINTAINING.md#backup)

---

## Auto-deploy
merge main → CI build+push GHCR → Watchtower บน VM ดึงมา deploy เอง (ดู [CICD.md](CICD.md))
เปิดใช้เมื่อ `docker login ghcr.io` บนเครื่องแล้ว: `$DC up -d` (ไม่ใส่ `--scale watchtower=0`)
ระหว่างนี้อัปเดตด้วยมือ: `git pull` → build (ข) ใหม่ → `$DC up -d --scale watchtower=0`

## Troubleshooting (เจอจริงตอนขึ้น Vultr)
| อาการ | สาเหตุ / แก้ |
|---|---|
| Lark error **20029** ตอน login | redirect URI ใน Lark Console ไม่ตรงกับ `LARK_REDIRECT_URI` (http/https, ตัวสะกด, `/api/auth/callback`) |
| `npm run lark:authorize` ได้ `invalid_grant` / code ใช้ไปแล้ว | เดิม callback เอา code ไป login ก่อน → **แก้แล้ว** (callback แยก flow) · ใช้ปุ่ม "เชื่อม Lark ใหม่" แทน |
| login แล้ววนกลับหน้า "เข้าสู่ระบบ" | cookie secure ถูกทิ้งเพราะ proxy ส่ง proto ผิด → **แก้แล้ว** (nginx `$fwd_proto`) · ถ้ายังเจอ: เช็ก `NODE_ENV=production` |
| cert ไม่ออก (Caddy loop) | DuckDNS ยังไม่ชี้ IP ถูก / port 80 ปิด (ACME ต้องใช้ 80) / `PUBLIC_DOMAIN` มี `https://` |
| `docker compose` บอกไม่มี env | ไม่ได้สร้าง root `.env` (ข้อ 4) หรือไม่ได้อยู่ในโฟลเดอร์ `Dashboard_PM` |
| build ค้าง / โดน kill | RAM ไม่พอ → เปิด swap (ข้อ 1) |
| IP VPS เปลี่ยน | อัปเดต current ip ที่ DuckDNS |
