# Cloudflare Tunnel — HTTPS ฟรี ไม่ต้องเปิด port

> แก้ปัญหา "provider ไม่เปิด port / เปิดผิด" ถาวร + ได้ HTTPS ฟรี + ปลดล็อก Lark SSO
> ใช้ได้กับ **กล่องไหนก็ได้** ที่รัน Docker (Oracle Free VM / Fly / VPS)

## ทำไมต้อง tunnel
- server **ยิง outbound** ไปหา Cloudflare เอง → ไม่ต้องเปิด port 80/443/22 เข้าเลย
- Cloudflare ออก **HTTPS cert ฟรี** + renew อัตโนมัติ (ไม่ต้อง Caddy/certbot)
- ใช้ **subdomain ของบริษัทที่มีอยู่แล้ว** เช่น `pmo.elegance.co.th` → ฟรี (ไม่ต้องซื้อ domain ใหม่)

```
Internet ─HTTPS─► Cloudflare edge ─(tunnel, outbound)─► cloudflared ─► web:80 ─► server:3000
                                                         (ในกล่องเรา ไม่มี port เปิดเข้า)
```

---

## ตั้งค่าครั้งเดียว

### 1. เพิ่ม domain เข้า Cloudflare (ถ้ายังไม่ได้ทำ)
- ล็อกอิน [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** → `elegance.co.th`
- Cloudflare จะให้เปลี่ยน **nameserver** ที่ผู้ให้บริการ domain เดิม → รอ active
  (ถ้า domain อยู่ใน Cloudflare อยู่แล้ว ข้ามข้อนี้)

### 2. สร้าง Tunnel
- Cloudflare Dashboard → **Zero Trust** → **Networks → Tunnels** → **Create a tunnel**
- เลือก **Cloudflared** → ตั้งชื่อ เช่น `pmo-dashboard` → **Save**
- หน้าถัดไปจะโชว์ **token** (ขึ้นต้น `eyJ...`) — **คัดลอกไว้** (ใช้ข้อ 4)
  > เอาเฉพาะ token ไม่ต้องรันคำสั่งติดตั้งที่มันโชว์ (เรารันผ่าน Docker แล้ว)

### 3. ผูก hostname → service (ในหน้า Tunnel เดียวกัน แท็บ Public Hostname)
- **Add a public hostname**
  - Subdomain: `pmo` · Domain: `elegance.co.th`  → ได้ `pmo.elegance.co.th`
  - Type: **HTTP** · URL: **`web:80`**
    (cloudflared อยู่ใน docker network เดียวกับ `web` → เรียกด้วยชื่อ service ได้)
- Save

### 4. ใส่ token บนกล่อง + start
`.env` (root ของโปรเจกต์บนกล่อง):
```dotenv
CLOUDFLARE_TUNNEL_TOKEN=eyJ...ที่คัดจากข้อ 2...
```
รัน (มี `--profile tunnel` เพิ่ม cloudflared เข้า stack):
```bash
export POSTGRES_PASSWORD=<pass>
docker compose -f docker-compose.prod.yml --profile tunnel up -d
```
เช็ก: `docker compose -f docker-compose.prod.yml logs -f cloudflared` → เห็น `Registered tunnel connection` = ขึ้นแล้ว
เปิด **https://pmo.elegance.co.th** ได้เลย (HTTPS อัตโนมัติ)

### 5. ปิด port เข้าให้หมด (ปลอดภัยสุด)
เมื่อ tunnel ใช้ได้แล้ว **ไม่ต้องเปิด port อะไรที่ firewall เลย** — ปิด 80/443/3000 จาก public ได้หมด
(เข้า SSH ผ่าน Cloudflare Tunnel ได้อีก ถ้าอยากปิด 22 ด้วย — ดู Cloudflare "SSH over Tunnel")

---

## เปิด Lark SSO ต่อทันที (tunnel ปลดล็อกให้แล้ว)
ตอนนี้มี HTTPS + domain จริงแล้ว → ทำ [NEXT-SSO.md](NEXT-SSO.md) ต่อได้เลย:
`server/.env.production`:
```dotenv
AUTH_MODE=lark_sso
COOKIE_SECURE=true
TRUST_PROXY=true
LARK_REDIRECT_URI=https://pmo.elegance.co.th/api/auth/callback
```
+ เพิ่ม redirect URI เดียวกันใน Lark Console + seed whitelist AppUser
> ⚠️ ต้องเปิด SSO ก่อนเปิดให้คนนอกเข้า — ตอน `AUTH_MODE=dev` ทุกคน = ADMIN

---

## กล่องที่แนะนำ (ฟรี)
| กล่อง | ฟรี | หมายเหตุ |
|---|---|---|
| **Oracle Cloud Always Free** | ฟรีถาวร (ARM 4-core/24GB) | แรงสุด · สมัคร verify บัตร (ไม่ตัดเงิน) · ARM บาง region เต็มบ่อย ลองหลายรอบ |
| **Fly.io** | free allowance (เล็ก) | รัน Docker เดิมได้ · Fly ให้ HTTPS เองก็ได้ (ไม่ใช้ tunnel ก็ได้) |
| VPS ราคาถูก | ~$4-5/มด | คุมเต็ม · tunnel ทำให้ไม่ต้องเปิด port |

> ทุกกล่องใช้ tunnel config เดียวกันหมด (ข้อ 2-4) — แค่เอา Docker stack ไปวางแล้ว `--profile tunnel up`

## Troubleshooting
| อาการ | แก้ |
|---|---|
| `cloudflared` error `token is required` | ยังไม่ตั้ง `CLOUDFLARE_TUNNEL_TOKEN` ใน `.env` (ข้อ 4) |
| เปิด domain แล้ว 502 | public hostname ชี้ผิด — ต้อง `web:80` (ไม่ใช่ localhost/IP) |
| domain ยังไม่ขึ้น | nameserver ยัง propagate ไม่เสร็จ (ข้อ 1) รอสักพัก |
| อยากได้ URL ทดสอบเร็ว ๆ ไม่มี domain | `docker run cloudflare/cloudflared tunnel --url http://localhost:80` ได้ URL `*.trycloudflare.com` ชั่วคราว (ไม่ใช้ production) |
