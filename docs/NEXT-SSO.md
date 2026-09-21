# NEXT — Lark SSO + HTTPS ฟรี (งานถัดไป)

> เป้าหมาย: ปิด dev-mode (ทุกคน ADMIN) → Lark SSO จริง + HTTPS ฟรี ก่อนเปิด public
> พร้อมของ: LarkSsoAuth code, Login page, AuthGate, whitelist — ทำไว้แล้ว รอ config + ทดสอบจริง

## Context
- Server จริง: `203.150.48.37` (Ubuntu 22.04, Docker, deploy สำเร็จ + sync แล้ว)
- ตอนนี้ `AUTH_MODE=dev` → auto-login ADMIN (ใครเข้า 80 ก็ ADMIN)
- ติด: provider ต้องเปิด **port 80 + 443** (+ 22 SSH, จำกัด source IP) — portal ไม่มี firewall UI, ต้องแจ้ง provider

## สิ่งที่พร้อมแล้ว (ไม่ต้องเขียนใหม่)
- `server/src/api/auth/provider.js` — `LarkSsoAuth.handleCallback()` ใช้ `exchangeCodeForUserInfo` (แยก token login ออกจาก token ETL ของข้าว — ‼️ อย่าใช้ exchangeCodeForToken ที่นี่ จะทับ token ETL)
- `server/src/api/routes/auth.js` — `/login /callback /me /logout`
- `web/src/lib/auth.tsx` (AuthGate) + `web/src/pages/Login.tsx` (ปุ่มเข้าด้วย Lark + หน้า 403)
- env harden: `COOKIE_SECURE` / `TRUST_PROXY` จาก env (config/env.js)

## แผนทำ (ตามลำดับ)

### 1. Domain ฟรี (เลือก 1)
- **DuckDNS** (แนะนำ, ชัวร์กับ Let's Encrypt): สมัคร → subdomain เช่น `elegancepmo.duckdns.org` → ตั้ง IP `203.150.48.37`
- **nip.io** (ไม่ต้องสมัคร): `203-150-48-37.nip.io`

### 2. Caddy auto-HTTPS (แทน nginx)
เปลี่ยน `web/` container จาก nginx → **Caddy** (ขอ Let's Encrypt + renew อัตโนมัติ)
- `web/Caddyfile`:
```
<domain> {
    reverse_proxy /api/* server:3000
    root * /srv
    file_server
    try_files {path} /index.html
}
```
- `web/Dockerfile` (build stage เดิม) → `FROM caddy:alpine` copy dist → /srv + Caddyfile
- `docker-compose.prod.yml` web: ports `80:80` + `443:443` · volume caddy_data (เก็บ cert)
- ต้อง port 80 (ACME challenge) + 443 เปิดที่ provider

### 3. Lark Console
เพิ่ม redirect URI: `https://<domain>/api/auth/callback` (ดู docs/DEV.md เรื่อง 3-host)

### 4. env.production → SSO mode
```dotenv
AUTH_MODE=lark_sso
COOKIE_SECURE=true
LARK_REDIRECT_URI=https://<domain>/api/auth/callback
```

### 5. Whitelist AppUser (ใครเข้าได้)
seed หรือ Admin: สร้าง `AppUser` (email/larkOpenId + role ADMIN/PM/VIEWER)
- SSO callback หา AppUser ด้วย openId/email → ไม่พบ = 403 (ไม่ auto-create)

### 6. ทดสอบ SSO flow จริง
เข้า `https://<domain>` → เด้ง Login → ปุ่ม Lark → login → callback → whitelist → เข้า
- ยังไม่เคยทดสอบ flow เต็ม(ต้อง domain + redirect URI จริง)

## หลังจากนั้น — vision หลายแผนก (เฟสถัดไป)
ระบบรองรับแล้ว (1 ETL/DB, query ด้วย dept_code · FE/BE แยก container)
ต้องเพิ่ม:
1. **หน้า landing/menu** หลัง login → เลือกแผนก (PM/BA/QA/UXUI)
2. **role/dept → บอร์ดที่เห็น** (map AppUser → dept → dashboard)
3. **QA/BA/UXUI dashboard** (spec `03/04/05-*.md` — ยังไม่ทำ, PM คือแผนกแรกที่เสร็จ)

## Checklist ก่อน public
- [ ] provider เปิด 80 + 443 (+ 22 จำกัด IP)
- [ ] domain ชี้ IP
- [ ] Caddy HTTPS ขึ้น (cert ออก)
- [ ] AUTH_MODE=lark_sso + redirect URI ใน Lark Console
- [ ] whitelist AppUser ครบ
- [ ] ทดสอบ SSO login สำเร็จ
- [ ] ปิด/จำกัด dev-mode (ห้าม 80 public ตอน AUTH_MODE=dev)
