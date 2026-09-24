# Migration — POC → Staging (domain บริษัท)

> ย้ายจาก POC (Oracle + DuckDNS + Caddy) → staging (server + domain บริษัท เช่น `pmo.elegance.co.th`)
> **หลักการ: swap เท่านั้น** — compose/image/code เดิมทั้งหมด เปลี่ยนแค่ env + ingress + DNS

## ทำไมย้ายง่าย (ยืนยันจาก code)
- `LARK_REDIRECT_URI` อ่านจาก env ล้วน (ไม่สร้างจาก request host) → เปลี่ยน domain = แก้ env
- frontend เรียก `/api` relative · nginx `server_name _` · ไม่มี CORS · cookie ไม่ผูก domain
- ingress เป็น profile: **POC=`caddy` → staging=`tunnel`** (Cloudflare Tunnel, ดู [CLOUDFLARE-TUNNEL.md](CLOUDFLARE-TUNNEL.md))
→ **ไม่แก้ code · ไม่ rebuild frontend · ไม่แตะ CORS/cookie**

## สิ่งที่เปลี่ยนต่อ environment (ทั้งหมด)
| ที่ | POC | Staging |
|---|---|---|
| box | Oracle Free VM | server บริษัท / staging |
| domain | `elegancepmo.duckdns.org` | `pmo.elegance.co.th` |
| ingress (COMPOSE_PROFILES) | `caddy` | `tunnel` |
| HTTPS | Caddy + Let's Encrypt (เปิด 80/443) | Cloudflare Tunnel (ไม่เปิด port) |
| `LARK_REDIRECT_URI` | .../duckdns.org/... | .../elegance.co.th/... |
| `SESSION_SECRET` | ค่า POC | **ค่าใหม่** |
| Lark Console redirect URI | ของ POC | เพิ่มของ staging |

---

## ขั้นตอน migrate

### 1. เตรียม staging box
```bash
sudo apt install -y docker.io docker-compose-v2 git
git clone https://github.com/thanapholelegance502/Dashboard_PM.git && cd Dashboard_PM
echo <GHCR_PAT> | docker login ghcr.io -u thanapholelegance502 --password-stdin
```

### 2. ข้อมูล — เลือก 1
- **เริ่มสด (แนะนำ)** — ข้อมูลมาจาก Lark อยู่แล้ว:
  ```bash
  DC="docker compose -f docker-compose.prod.yml"
  $DC exec -T server npm run seed
  $DC exec -T server npm run seed:appusers
  $DC exec server npm run lark:authorize
  $DC exec server npm run sync:once -- --snapshot
  ```
- **ย้ายของเดิม** (เก็บ override/budget/AppUser/snapshot ที่กรอกช่วง POC):
  ```bash
  # บน POC:
  docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres pmo | gzip > pmo.sql.gz
  # โอนไฟล์ไป staging แล้ว:
  gunzip -c pmo.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres pmo
  ```
  > ⚠️ ก่อน restore ให้ DB staging ว่าง/migrate แล้ว · pg_dump ทุกครั้งก่อนแตะข้อมูล (กติกา §4)

### 3. env staging
`server/.env.production`:
```dotenv
NODE_ENV=production
AUTH_MODE=lark_sso
LARK_REDIRECT_URI=https://pmo.elegance.co.th/api/auth/callback   # เปลี่ยน
SESSION_SECRET=<random ใหม่>                                       # เปลี่ยน
# (LARK_APP_SECRET, DATABASE_URL, APP_* ตามเดิม/ตามค่าของ staging)
```
root `.env`:
```dotenv
POSTGRES_PASSWORD=<...>
COMPOSE_PROFILES=tunnel                # เปลี่ยนจาก caddy
CLOUDFLARE_TUNNEL_TOKEN=<token>        # จาก Cloudflare (ดู CLOUDFLARE-TUNNEL.md)
```

### 4. Lark Console
เพิ่ม redirect URI ของ staging `https://pmo.elegance.co.th/api/auth/callback`
(**ยังไม่ลบของ POC** จนกว่าจะ cutover เสร็จ — เผื่อ rollback)

### 5. Cloudflare Tunnel
สร้าง tunnel + public hostname `pmo.elegance.co.th → http://web:80` (ขั้นตอนใน [CLOUDFLARE-TUNNEL.md](CLOUDFLARE-TUNNEL.md))

### 6. ขึ้น staging + ทดสอบ
```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d     # COMPOSE_PROFILES=tunnel → cloudflared ขึ้น
```
ทดสอบ SSO บน `https://pmo.elegance.co.th` (คนใน whitelist เข้าได้ / นอก = 403)

### 7. Cutover
- แจ้งผู้ใช้เปลี่ยนไป URL staging
- ลบ redirect URI ของ POC ออกจาก Lark Console
- ปิด POC VM (Oracle) — ถ้าจะเก็บเป็น backup ชั่วคราวก็ได้

## Rollback
- POC ยังอยู่จนกว่า staging ผ่าน — ถ้า staging มีปัญหา ชี้ผู้ใช้กลับ POC ได้ทันที
- ระดับ image: `bash rollback.sh sha-<commit>` (ดู [CICD.md](CICD.md))

## Checklist
- [ ] staging box + docker login ghcr
- [ ] ข้อมูล (เริ่มสด หรือ pg_dump/restore + pg_dump สำรอง)
- [ ] env: LARK_REDIRECT_URI + SESSION_SECRET + COMPOSE_PROFILES=tunnel + tunnel token
- [ ] Lark Console redirect URI (staging) — ยังไม่ลบ POC
- [ ] Cloudflare Tunnel + public hostname → web:80
- [ ] whitelist AppUser ครบ (seed:appusers ถ้าเริ่มสด)
- [ ] ทดสอบ SSO staging ผ่าน → cutover → ลบ redirect URI POC
