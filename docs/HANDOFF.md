# HANDOFF — เริ่มแชท/session ใหม่อ่านหน้านี้ก่อน

> อัพเดต 28 ก.ย. 2026 · เขียนให้ AI session ใหม่รู้ครบว่า "ถึงไหน · ค้างอะไร · ระวังอะไร" โดยไม่ต้องย้อนอ่านแชทเก่า
> ลำดับอ่าน: **ไฟล์นี้** → [CLAUDE.md](../CLAUDE.md) (กติกา) → [STATUS.md](STATUS.md) (ตารางสถานะ) → เอกสารเฉพาะเรื่อง

---

## 1. ระบบตอนนี้ (ใช้งานจริงแล้ว)

```
https://elegancedb.duckdns.org  (Vultr · Ubuntu · Caddy HTTPS · DuckDNS)
 └ nginx (container web) ─┬─ /        Portal: หน้าแรกเลือกบอร์ด · PM Portfolio · การเงิน (C-level) · ตั้งค่า   ← repo Dashboard_PM
                          ├─ /api/    backend Portal (Lark SSO, whitelist, สิทธิ์บอร์ด, ETL PM)            ← repo Dashboard_PM
                          ├─ /qa/     บอร์ด QA (เช็กสิทธิ์บอร์ด QA ก่อน)                                  ← repo Dashboard_Tester
                          └─ /ba/     บอร์ด BA (เช็กสิทธิ์บอร์ด BA ก่อน)                                  ← repo Dashboard_BA
 Postgres ตัวเดียว: database `pmo` (Portal) · `ba` (user ba_app) · QA ยังใช้ Supabase ของทีม tester
```

| repo (บัญชี `thanapholelegance502`) | branch หลัก | ใครแก้ | deploy |
|---|---|---|---|
| **Dashboard_PM** (public) | `main` | AI + ข้าว | merge → CI test + build → GHCR `dashboard_pm-{server,web}` → watchtower (~2–5 นาที) |
| **Dashboard_Tester** (private) | **`Main`** (M ใหญ่) | ทีม tester ผ่าน PR | merge → GHCR `dashboard_tester` → watchtower (container `qa`) |
| **Dashboard_BA** (private) | `main` | ทีม BA ผ่าน PR (น้อง Parunyu) | merge → GHCR `dashboard_ba` → watchtower (container `ba`) · มีประตู `RELEASER` แล้ว |
| Dashboard_C_level (private) | — | ยังว่าง | บอร์ด C-level ใช้หน้า `/finance` ใน Portal ไปก่อน |

- compose บน server: `~/Dashboard_PM/docker-compose.prod.yml` · root `.env` → `COMPOSE_PROFILES=caddy,qa,ba`
- env บน server (ไม่ขึ้น git): `server/.env.production` · `qa.env` · `ba.env` · `.env`
- Lark app **ตัวเดียว** ใช้ทั้ง Portal / QA / BA (App ID `cli_aa20a1d6d338def1`) · ทุกตัวใช้ **user OAuth** (Lark Task เชิญ bot เข้า tasklist ไม่ได้)
  - redirect URI ที่ลงไว้: `/api/auth/callback` (Portal) · `/qa/api/lark/oauth/callback` · `/ba/api/lark/oauth/callback`

---

## 2. กติกาทำงานกับข้าว (สำคัญ)

- ตอบ **ภาษาไทย กระชับ** · ข้าว = PM ผู้สั่งงาน/ผู้ merge
- ทุกอย่างผ่าน **branch + PR** · **AI merge ได้เฉพาะตอนข้าวสั่งชัด ณ ตอนนั้น** ("merge เลย") · ห้าม push `main`
- branch ของ AI ใน Dashboard_PM: `claude/dashboard-pm-pending-work-woqrgl` (PR merge แล้ว = เริ่มใหม่จาก `origin/main` ชื่อเดิม)
- repo แผนก (Tester / BA): ทีมเปิด PR เอง → AI รีวิวได้ · **merge เมื่อข้าวสั่งเท่านั้น** · ห้ามอ่าน `oracle_key*` ใน Dashboard_Tester
- Dashboard_PM เป็น **public** → ห้าม commit อีเมลข้าว, secret, token, ชื่อลูกค้าจริง (ใช้ project_code / ชื่อสมมติ)
- ทุก mutation ลง AuditLog · ETL ล้ม ห้ามล้างตาราง · ตัวเลขต้อง drill-down กลับ Lark ได้
- sandbox ของ AI **เข้า `elegancedb.duckdns.org` / Lark API ไม่ได้** (proxy บล็อก) → งานบน server = ส่งคำสั่งให้ข้าวรัน แล้วขอผลกลับ

---

## 3. ทำเสร็จล่าสุด (22–28 ก.ย.)

| เรื่อง | ที่ไหน |
|---|---|
| CI/CD + watchtower ทำงานจริง (แก้ `DOCKER_API_VERSION=1.44` + mount โฟลเดอร์ docker config) | PR #4 · [CICD.md](CICD.md) |
| WAITING status (PM ตั้งเอง) · เอา Forecast ออก · Gantt คอลัมน์ Target/Actual Go-Live · ลบไอคอนกุญแจ | PR #5 |
| login หา whitelist ด้วยอีเมลบริษัท (enterprise_email) + ไม่สนตัวพิมพ์ | PR #6 |
| **Redesign UI ทั้ง Portal** ตาม Claude Design "Elegance PMO Design System v0.1" (sidebar กรมท่า · IBM Plex Sans Thai · วันที่ พ.ศ. · เงิน `ลบ.` · dialog แทน prompt · ยืนยันก่อนลบ) — frontend อย่างเดียว | PR #7 · [DESIGN-BRIEF.md](DESIGN-BRIEF.md) · รูป `docs/design/after/` |
| **บอร์ด QA เปิดบน server แล้ว** (token ของแอป QA เอง) + **รายงาน Tester ตามช่วงวัน** (snapshot รายวัน `task_stage_snapshot`, cohort Ready for Test/Testing → done/fail/pending/returned/missing) | Dashboard_Tester PR #5 |
| **บอร์ด BA เปิดบน server แล้ว** ที่ `/ba/` · DB `ba` แยก · user OAuth + เลือกบอร์ดในหน้า `/ba/admin` | Dashboard_PM PR #8–#10 · Dashboard_BA PR #1–#2 · [BA-ONBOARDING.md](BA-ONBOARDING.md) · [BA-LARK-AUTH.md](BA-LARK-AUTH.md) |

---

## 4. ค้าง / รอ (เรียงตามความสำคัญ)

### รอข้าว
- [ ] ปิด SSH password บน Vultr (ใช้ key อย่างเดียว) → [MAINTAINING.md#h-3](MAINTAINING.md#h-3--ปิด-port--ssh-ใช้-key-อย่างเดียว) — ข้าวสั่ง "note ไว้ ไม่ต้องเตือนบ่อย"
- [ ] copy backup ออกนอกเครื่อง / เปิด Vultr Automatic Backups (ตอนนี้ backup อยู่ดิสก์เดียวกับ VM)
- [ ] branch protection (ถ้าอัปเกรด GitHub Pro) — Dashboard_PM `main` · Tester `Main` · BA `main`
- [ ] ส่งผล `docker compose -f docker-compose.prod.yml exec -T qa node scripts/audit-tester-data.js` → AI ตรวจความถูกต้องข้อมูล QA (ชื่อ section / tester ที่พบ / จำนวนต่อ stage) — **ยังไม่ได้รับ**
- [ ] บอร์ด BA: ติ๊กสิทธิ์ BA ให้ทีม · import snapshot เดิม (ถ้ายังไม่ได้ทำ) · ดูว่า sync อัตโนมัติ 08:00/17:00 วิ่ง

### รอทีม tester (Dashboard_Tester)
- [ ] ใส่ประตู `RELEASER` ใน CI (ตอนนี้ใคร push `Main` ก็ deploy — tester เคย merge เอง)
- [ ] มี **2 instance เขียน Supabase เดียวกัน** (ของเรา + ของทีม tester) → ต้องเหลือตัวเดียว (ของบน server)
- [ ] bug: `sync_meta` ค้างสถานะ "syncing" เมื่อ sync ล้ม
- เฟสถัดไป (ยังไม่ทำ): ย้าย DB QA จาก Supabase มา database `qa` ในเครื่อง (`scripts/create-board-db.sh qa`, `DATABASE_SSL=false`)

### ทางเลือกที่เสนอข้าวไว้ (ยังไม่สั่ง)
- BA: มุมมอง "ย้อนดูสถานะ ณ วันที่เลือก" จาก `task_snapshots` (ตอนนี้ filter วันที่ = คำนวณจากสถานะล่าสุด + วันที่ของงาน) → ถ้าข้าวเอา = เขียน md ส่งทีม BA
- Roadmap Portal: ดู [STATUS.md → Roadmap](STATUS.md#-roadmap-ถัดไป-ข้าวเลือกลำดับ)

---

## 5. บทเรียนที่เจอจริง (อย่าพลาดซ้ำ)

- **compose อ่าน `env_file` ของทุก service** → ต้องมี `qa.env` / `ba.env` ก่อนรัน `docker compose` ใด ๆ (รวม `scripts/create-board-db.sh`) ไม่งั้น `env file … not found`
- `create-board-db.sh` **ไม่พิมพ์รหัสซ้ำ** ถ้า user มีแล้ว → ลืมรหัส = `ALTER ROLE <x>_app PASSWORD '<ใหม่>'` แล้วแก้ `DATABASE_URL` (เจอ `password authentication failed`)
- แอป BA: `ba.env` ต้อง `NODE_ENV=production` (ว่าง = โหมด dev ให้ ADMIN เมื่อไม่มี header)
- Lark: **3 host** — authorize `accounts` · token/user_info `open.larksuite.com` · task/contact `open-sg` · refresh token หมุนทุกครั้ง → เขียนทับใน transaction + `FOR UPDATE`
- Lark Task **เชิญ bot ไม่ได้** → tenant_access_token อ่าน tasklist ไม่ได้ → ใช้ user OAuth เสมอ
- QA: `LARK_REDIRECT_URI` ต้องชี้ `/qa/…` ของโดเมนนี้ · ต้องมี `DATABASE_URL` ใน `qa.env` (ไม่งั้นแอปไม่เก็บข้อมูล)
- watchtower: `DOCKER_API_VERSION=1.44` · mount **โฟลเดอร์** docker config (ไม่ใช่ไฟล์ — ถ้า up ก่อน login จะได้โฟลเดอร์ `config.json` แล้ว `docker login` พัง → `rm -rf` แล้ว login ใหม่)
- ใน sandbox: อย่าใช้ `pkill -f`/`pgrep -f` (ฆ่า shell ตัวเอง) → kill ตาม port · Playwright ใช้ global install + `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` + `ignoreHTTPSErrors` (ฟอนต์ Google ผ่าน proxy)

---

## 6. คำสั่งบน server ที่ใช้บ่อย

```bash
cd ~/Dashboard_PM && DC="docker compose -f docker-compose.prod.yml"
git pull                                   # เอา compose/nginx/docs ล่าสุด (image อัปเดตเองผ่าน watchtower)
$DC ps                                     # ดูทุก container
$DC logs --tail 50 server|web|qa|ba|watchtower
$DC up -d                                  # หลังแก้ .env / *.env
$DC exec -T postgres psql -U postgres -d pmo          # เข้า DB Portal
bash scripts/backup-db.sh                  # backup ทุก database (cron 02:15 ทำให้อยู่แล้ว)
bash scripts/create-board-db.sh <board>    # DB แยกให้บอร์ดแผนกใหม่ (ต้องมี <board>.env ก่อน)
```

## 7. เปิดแชทใหม่ พิมพ์ประมาณนี้
> อ่าน `docs/HANDOFF.md` + `CLAUDE.md` + `docs/STATUS.md` ของ Dashboard_PM ก่อน แล้วสรุปสั้น ๆ ว่าค้างอะไร — งานวันนี้คือ …
