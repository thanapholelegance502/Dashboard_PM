# MAINTAINING — คู่มือดูแลระบบ (day-2 ops)

> สำหรับคนที่มารับช่วงดูแลต่อ · อ่าน [README](../README.md) + [ARCHITECTURE](ARCHITECTURE.md) ก่อน

---

## งานประจำ

### ดู sync ว่าทำงานปกติ
- cron ดึงอัตโนมัติ 08:00 / 17:00 (Asia/Bangkok) เมื่อ backend รันอยู่
- เช็คประวัติ: หน้า Admin (จะเพิ่มแท็บสถานะระบบ) หรือ query `SyncRun` ล่าสุด
```sql
SELECT id, status, trigger, "tasksFetched", "projectsFail", "startedAt"
FROM "SyncRun" ORDER BY id DESC LIMIT 10;
```
- `status`: SUCCESS ปกติ · PARTIAL = บางบอร์ดดึงไม่ได้ (ดู errorText) · FAILED = พังทั้งรอบ

### Sync ด้วยมือ
- ปุ่ม **Sync now** บนหน้า PM · หรือ `cd server && npm run sync:once`

---

## เหตุการณ์ที่ต้องจัดการ

### 🔴 Token Lark หมด / "ต้อง re-authorize"
เกิดเมื่อ refresh token พัง (ข้าวเปลี่ยน password / เพิกถอนสิทธิ์ / ไม่ได้ sync นานมาก)
หน้า **ตั้งค่า** จะขึ้นกล่องสีเหลือง "token หมดอายุ" ให้ ADMIN เห็นเอง

1. ADMIN เปิด **ตั้งค่า → ปุ่ม "เชื่อม Lark ใหม่"**
2. login/อนุญาตด้วย **บัญชีข้าว (เจ้าของ token)** → กลับมาเห็น "เชื่อม Lark สำเร็จ" (ลง AuditLog `OAuthToken`)
3. Dashboard → **Sync now**

ทางสำรอง (ไม่มีหน้าเว็บ / เครื่อง dev):
```bash
docker compose -f docker-compose.prod.yml exec server npm run lark:authorize   # server
cd server && npm run lark:authorize                                           # เครื่อง dev
```
→ เปิด URL → login → หน้า callback โชว์คำสั่ง `--code …` → ก็อบไปรันภายใน ~1 นาที

> ETL ใช้ token ในนาม "ข้าว" (user_access_token) — ต้องเป็นคนเดิมที่เป็นสมาชิกทุกบอร์ด
> ปุ่มนี้กันปลอมด้วย `state` ที่ผูกกับ session ของ ADMIN คนที่กด (ใช้ได้ครั้งเดียว) → คนอื่นยัดบัญชีตัวเองเป็น token ETL ไม่ได้

### เพิ่มบอร์ด/โปรเจกต์ใหม่
1. Admin → โครงการ → **+ เพิ่มโครงการ** → วาง Lark `tasklist_guid` (ก็อบจาก URL บอร์ด)
2. **ข้าวต้องเป็นสมาชิกบอร์ดนั้นใน Lark** ไม่งั้นดึงไม่ได้ (403)
3. Sync now
4. Admin → **Section Rules** → banner เตือน section ที่ยังไม่ map → กด map → เลือก dept/bucket/weight → บันทึก (recompute ทันที)

### progress/ตัวเลขเพี้ยนหลังเพิ่มบอร์ด
= section ใหม่ยังไม่ map (`deptCode=NONE`, weight 0 ดึง progress ลง) → ดู banner ในแท็บ Section Rules แล้ว map

### แก้ weight / การจัดกลุ่ม section
Admin → Section Rules → แก้ dept/bucket/weight inline → recompute อัตโนมัติ (ไม่ต้องยิง Lark ใหม่)

---

## Backup

`scripts/backup-db.sh` — dump **ทุก database** ใน Postgres ของ stack (`pmo` + บอร์ดแผนก เช่น `qa` — บอร์ดใหม่ได้อัตโนมัติ) ด้วย `pg_dump -Fc`
เก็บที่ `/var/backups/pmo/<YYYY-MM-DD_HHMM>/<db>.dump` + ลิงก์ `latest` · ลบชุดเก่ากว่า 14 วัน · dump ล้ม = exit 1 (ไม่ลบชุดเก่า)

```bash
# ตั้ง cron ครั้งเดียวบน server (ทุกวัน 02:15) — แก้ path ให้ตรงที่ clone ไว้
crontab -e
15 2 * * * cd /root/Dashboard_PM && bash scripts/backup-db.sh >> /var/log/pmo-backup.log 2>&1

# ลองรันมือ + ดูผล
bash scripts/backup-db.sh && ls -lh /var/backups/pmo/latest/
tail /var/log/pmo-backup.log

# ปรับได้: KEEP_DAYS=30 BACKUP_DIR=/data/backup bash scripts/backup-db.sh
```

**กู้คืน** (ตัวอย่าง database `pmo` จากชุดล่าสุด):
```bash
DC="docker compose -f docker-compose.prod.yml"
$DC stop server                                   # กันเขียนระหว่างกู้
$DC exec -T postgres pg_restore -U postgres -d pmo --clean --if-exists < /var/backups/pmo/latest/pmo.dump
$DC start server
```
> ⚠️ **backup อยู่ดิสก์เดียวกับ VM** — VM หาย/ลบเครื่อง backup ก็หายด้วย → เปิด **Vultr Automatic Backups** (เสียเงินเล็กน้อย) หรือ copy `/var/backups/pmo/latest` ออกนอกเครื่องเป็นระยะ (เช่น `scp` ลงเครื่องตัวเอง)
> ข้อมูลการ์ดดึงจาก Lark ใหม่ได้เสมอ · **สิ่งที่ backup สำคัญ** = ที่กรอกมือ: ผู้ใช้/สิทธิ์บอร์ด, budget/งวดการเงิน, milestone dates, override, section rules, snapshot ประวัติ, token Lark

---

## H-3 — ปิด port + SSH ใช้ key อย่างเดียว
ข้าวรันเองบน server (ต้องมีคนถือ SSH key — AI ทำให้ไม่ได้)

```bash
# 1) firewall: เหลือ 22/80/443
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable && sudo ufw status
# (Vultr มี Firewall Group ในหน้า portal ด้วย — ตั้งกฎเดียวกันได้อีกชั้น)
```
> ℹ️ port ที่ docker publish (`ports:`) ข้าม ufw ได้ — stack นี้ publish ออกนอกแค่ caddy 80/443 (server ผูก `127.0.0.1:3000` เฉพาะในเครื่อง · postgres ไม่มี `ports:`) → อย่าเพิ่ม `ports:` ให้ postgres

```bash
# 2) SSH key — ทำบนเครื่องตัวเอง (ไม่ใช่ server)
ssh-keygen -t ed25519            # ถ้ายังไม่มี key
ssh-copy-id root@<IP>            # ใส่ password ครั้งสุดท้าย
ssh root@<IP>                    # ⚠️ ต้องเข้าได้โดย "ไม่ถาม password" ก่อนทำข้อ 3

# 3) ปิด password login — บน server
#    ใช้ไฟล์ 00-… เพราะ Ubuntu cloud image มี sshd_config.d/50-cloud-init.conf ที่เปิด password ไว้ (ค่าแรกที่เจอชนะ)
echo 'PasswordAuthentication no' | sudo tee /etc/ssh/sshd_config.d/00-no-password.conf
sudo sshd -t && sudo systemctl restart ssh
sudo sshd -T | grep -i passwordauthentication     # ต้องได้ "passwordauthentication no"
```
> ⚠️ ถ้าข้าม "ลอง login ด้วย key" แล้วปิด password → อาจล็อกตัวเองออก · ถ้าพลาด: Vultr portal → **View Console** เข้าได้เสมอ

---

## Troubleshoot

| อาการ | สาเหตุ / แก้ |
|---|---|
| sync FAILED + "REAUTHORIZE" | token พัง → ตั้งค่า → ปุ่ม "เชื่อม Lark ใหม่" |
| sync PARTIAL บางบอร์ด | ข้าวไม่ได้เป็นสมาชิกบอร์ด / บอร์ดถูกลบ → ดู `SyncRun.errorText` |
| ดึงการ์ดไม่ครบ | pagination — เช็ค `SyncRun.pagesFetched` (ต้องวนจน has_more=false) |
| 502 ตอน authorize/token | host ผิด — ต้องใช้ accounts/open (ดู ARCHITECTURE 3-host) |
| progress เพี้ยน/ต่ำ | section ยังไม่ map → banner Admin |
| KPI blocker ≠ list | ต้องมาจาก query เดียว (มี test ครอบ — อย่าแยกคำนวณ) |
| หน้าเว็บ error โหลด API | backend :3000 รันอยู่ไหม · proxy /api ถูกไหม |
| ทุกคนหลุด login หลัง restart | session ต้องอยู่ใน Postgres (ตาราง `session`) — log ขึ้น "ไม่มี DATABASE_URL → MemoryStore" = env ผิด |

---

## ก่อนแก้ logic — อ่าน spec
`00-MASTER.md` … `06-BUILD-PLAN.md` = สเปกกลาง (กติกาที่ล็อกแล้ว, สูตร KPI, bucket engine)
กติกาห้ามละเมิด → [STATUS.md](STATUS.md) ท้ายไฟล์

## Test ก่อน commit
```bash
cd server && npm run test:ci # unit tests (ไม่ต้องมี DB)
cd web && npm run build      # TS ไม่ error
```
