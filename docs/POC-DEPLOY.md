# POC Deploy — Oracle Free VM + DuckDNS + Caddy + Lark SSO

> hosting ฟรีชั่วคราว (1-2 เดือน) ไม่ใช้ domain/resource บริษัท · HTTPS จริง + SSO จริง
> ออกแบบให้ **ย้ายเข้า staging + domain บริษัท ได้ง่าย** → ดู [MIGRATION-POC-TO-STAGING.md](MIGRATION-POC-TO-STAGING.md)

```
Internet ─HTTPS─► Caddy (:443, Let's Encrypt) ─► web:80 (nginx) ─► server:3000
DuckDNS: elegancepmo.duckdns.org → Oracle VM public IP
```

## ทำไมชุดนี้
- **Oracle Always Free** = VM ฟรีถาวร (ARM แรง) + **เราคุม firewall เอง** (ปัญหาเดิมคือ provider คุม port ไม่ได้)
- **DuckDNS** = subdomain ฟรี URL คงที่ (ต่างจาก Cloudflare Quick Tunnel ที่ URL เปลี่ยนทุก restart)
- **Caddy** = HTTPS ฟรีจาก Let's Encrypt auto-renew (DuckDNS ใช้กับ Cloudflare Tunnel ไม่ได้ เพราะ domain ต้องอยู่บน Cloudflare)

---

## ตั้งค่าครั้งเดียว

### 1) Oracle Cloud — สร้าง VM + เปิด port
- สร้าง **Always Free** instance (Ubuntu 22.04) · แนะนำ **Reserve public IP** (กัน IP เปลี่ยน)
- **เปิด 80/443 สองชั้น** (⚠️ gotcha: Oracle บล็อกที่ OS ด้วย ไม่ใช่แค่ cloud):
  1. **Security List / NSG**: Ingress rule allow TCP 80, 443 (source 0.0.0.0/0)
  2. **บน OS**: 
     ```bash
     sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
     sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
     sudo netfilter-persistent save     # persist ข้าม reboot
     ```
- **ปิด/ไม่ต้องเปิด** port อื่น (3000/5432 ไม่ต้อง — อยู่ใน docker network + localhost)

### 2) DuckDNS
- [duckdns.org](https://www.duckdns.org) → login → สร้าง subdomain เช่น `elegancepmo`
- ตั้ง **current ip** = public IP ของ Oracle VM → ได้ `elegancepmo.duckdns.org`

### 3) Lark Console
- เพิ่ม redirect URI: `https://elegancepmo.duckdns.org/api/auth/callback`

### 4) Deploy บน VM
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker
git clone https://github.com/thanapholelegance502/Dashboard_PM.git && cd Dashboard_PM

# .env.production (backend)
cp server/.env.production.poc.example server/.env.production
nano server/.env.production   # ใส่ LARK_APP_SECRET, SESSION_SECRET, DB pass, LARK_REDIRECT_URI, APP_ADMINS

# root .env (compose) — เลือก ingress = caddy + ตั้ง domain
cat > .env <<EOF
POSTGRES_PASSWORD=<pass เดียวกับใน DATABASE_URL>
COMPOSE_PROFILES=caddy
PUBLIC_DOMAIN=elegancepmo.duckdns.org
ACME_EMAIL=you@elegance.co.th
EOF

# login GHCR (image private) — PAT read:packages (ดู docs/CICD.md)
echo <GHCR_PAT> | docker login ghcr.io -u thanapholelegance502 --password-stdin

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d     # COMPOSE_PROFILES=caddy → caddy ขึ้นด้วย
```

### 5) ครั้งแรก — seed + whitelist + authorize + sync
```bash
DC="docker compose -f docker-compose.prod.yml"
$DC exec -T server npm run seed              # section rules + projects
$DC exec -T server npm run seed:appusers     # whitelist จาก APP_ADMINS/APP_PMS/APP_VIEWERS
$DC exec server npm run lark:authorize       # ETL token ของข้าว (ผ่าน SSH tunnel — ดู DEPLOY.md)
$DC exec server npm run sync:once -- --snapshot
```

### 6) ทดสอบ SSO
เปิด **https://elegancepmo.duckdns.org** → เด้ง Login → ปุ่ม Lark → login → callback → เข้าได้
- คนที่ไม่อยู่ whitelist → **403** (ถูกต้อง)
- เช็ก cert: กุญแจเขียวใน browser · ถ้า cert ไม่ออก → `$DC logs -f caddy`

---

## Auto-deploy ยังทำงานเหมือนเดิม
merge main → CI build+push GHCR → Watchtower บน VM ดึงมา deploy เอง (ดู [CICD.md](CICD.md))
Caddy/DuckDNS ไม่เกี่ยว — ยังอัพเดทอัตโนมัติ

## Troubleshooting
| อาการ | แก้ |
|---|---|
| เปิด domain ไม่ติด / timeout | port 80/443 ยังไม่เปิดที่ OS (iptables ข้อ 1) — เช็ก `sudo iptables -L INPUT -n` |
| cert ไม่ออก (Caddy loop) | DuckDNS ยังไม่ชี้ IP ถูก / port 80 ปิด (ACME challenge ต้องการ 80) |
| login แล้วเด้งกลับ ไม่ค้าง session | `NODE_ENV=production` ไม่ได้ตั้ง → cookie secure/trust proxy ไม่เปิด (ดู .env.production) |
| 403 ทั้งที่ควรเข้าได้ | อีเมลไม่ตรง whitelist — รัน `seed:appusers` ใหม่หลังแก้ APP_ADMINS |
| IP VM เปลี่ยน | reserve IP บน Oracle หรืออัปเดต DuckDNS current ip |
