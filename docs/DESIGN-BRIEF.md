# Design Brief — Elegance PMO Portal (UI redesign, frontend only)

> **For:** Claude Design · **Owner:** Khao (PM, Elegance Consultant) · **Implementer afterwards:** Claude Code
> **Scope:** every screen of the portal web app (`web/`). The department QA board at `/qa/` is **out of scope** (separate app).
> **Goal:** a completely new, beautiful visual design — **the data shown and the behaviour stay exactly the same**. The backend/API does not change.
> Current screenshots: [`docs/design/current/`](design/current/) (fictional sample data).

---

## 1. Product in one paragraph

Elegance PMO is an internal **project-portfolio portal** for a software house. It pulls task cards from **Lark Task** (the company's task board) every few hours, computes progress / status / risks per client project, and shows them to **executives (CEO/CFO)** and **project managers**. After logging in with Lark (company SSO), a user picks a **department board**: PM Portfolio, QA (separate app), C-level Finance, and soon BA and UX/UI. Every number must be traceable back to the Lark cards behind it.

## 2. Users & what they need

| User | Opens | Needs in ≤10 seconds |
|---|---|---|
| **CEO / CFO** | PM Portfolio, Finance | Which projects are delayed / at risk and why · what needs their decision · how much money is outstanding / at risk |
| **Project Manager** | PM Portfolio, Settings | Timeline vs target · upcoming UAT / Go-Live · edit dates, overrides, payment installments |
| **Admin** | Settings | Users & board permissions · reconnect Lark · map Lark sections to departments |
| **Tester / other staff** | Board picker → their board | Get to their board fast |

## 3. Design goals

1. **Executive, calm, premium.** A C-level glance tool, not an engineering console. Generous whitespace, clear hierarchy, numbers first.
2. **Red means a problem — only.** Semantic status colours are sacred (see §8). No decorative red/amber.
3. **Scannable at a glance, drillable on demand.** Every KPI / count / chart slice stays clickable to its evidence (filters or the card drawer with "Open in Lark ↗").
4. **One visual system across all screens** (header, cards, tables, forms, badges, empty/loading/error states).
5. **Thai-first typography.** UI copy is Thai (plus some English labels). Pick a Thai font that looks excellent in both scripts (current: Sarabun — feel free to propose better, e.g. IBM Plex Sans Thai / Noto Sans Thai / Anuphan).

## 4. Hard constraints (must keep)

- **Every data point, control, filter, tooltip, state and link listed in §6 stays.** You may re-arrange, regroup, restyle, rename visually — not remove.
- **UI text stays in Thai as written** (strings quoted in §6). You may shorten labels only where noted as free.
- **Desktop-first 1280–1440 px**, fully usable on tablet and phone (≥ 360 px).
- **Print-friendly** PM & Finance pages (filters/drawers hidden when printing).
- Output must be implementable with **React 18 + Tailwind CSS + Recharts** (our stack). Express colours/spacing as Tailwind-compatible tokens.
- **No real client names** in mockups — use fictional codes like `PRJ_ALPHA`, "Project Alpha".
- Accessible contrast (WCAG AA) — the dashboard is shown on meeting-room TVs too.

## 5. Allowed improvements (still frontend-only)

- Replace the browser `prompt()` dialogs (status/progress override) with proper modal dialogs.
- Add confirmation before destructive actions (delete rule / delete installment / deactivate user).
- Proper **loading skeletons, empty states, error states** — with the app header visible (today PM/Finance show bare text).
- Toasts that auto-dismiss.
- Surface fields the API already returns but the UI doesn't show yet (optional, designer's call): `kpis.waiting`, Finance `totals.planned` / `cashflow.noDate` / `revenueAtRisk.items`, attention `issueType` / `neededBy`, drawer `planned` budget.
- Better mobile navigation (e.g. a menu sheet instead of the second nav row).
- **Not allowed:** new data the API doesn't provide, removing any existing information.

---

## 6. Screen-by-screen specification

Routes: `/` board picker · `/pm` portfolio · `/finance` finance · `/admin` settings. Login is shown by the auth wrapper (no route).
Roles: `ADMIN`, `PM`, `VIEWER`. Boards: `PM`, `QA`, `CLEVEL` (+ `BA`, `UX` "coming soon"). ADMIN has every board.

### 6.0 App shell (header, navigation, footer) — every signed-in screen
- **Header (brand colour, currently navy `#1e3a5f`)**
  - Page `title` + small `eyebrow` subtitle (per page, below).
  - Nav items (shown by permission):
    - "หน้าแรก" → `/` (everyone)
    - "Portfolio" → `/pm` (PM board)
    - "การเงิน" → `/finance` (CLEVEL board)
    - "ตั้งค่า" → `/admin` (role ADMIN or PM)
  - Active item indicator.
  - "As of" + last-sync timestamp (only on pages that pass it, e.g. PM: `24 Sep 10:22`).
  - Tagline (PM & Finance): "Deliver Projects. Create Business Value."
  - User chip: display name + "ออก" (logout).
- **Footer:** "On Time · On Quality · On Business Value" and "Elegance PMO · *From Plan to Impact*".
- **Mobile:** nav collapses (today: a second row).

### 6.1 Login (and "no permission" variant) — `01a-login.png`, `01b-login-forbidden.png`
- Centered card: "Elegance PMO Dashboard" / "Project Portfolio — Executive".
- **Normal:** primary button "เข้าสู่ระบบด้วย Lark" (→ Lark SSO).
- **Forbidden:** "🚫" · "บัญชี Lark ของคุณยังไม่มีสิทธิ์เข้าระบบ" (red) · "ติดต่อ Admin เพื่อขอเปิดสิทธิ์" · link "ลองเข้าด้วยบัญชีอื่น".
- Note under both: "ใช้บัญชี Lark ของบริษัท ไม่ต้องตั้งรหัสใหม่".
- Global loading state before auth resolves: "กำลังโหลด…".

### 6.2 Board picker (Landing) — `/` — `02-landing.png`
- Header title "Elegance PMO", eyebrow "เลือกบอร์ดแผนก".
- Optional red banner (after being bounced from a board without rights): "คุณยังไม่มีสิทธิ์เข้าบอร์ดนั้น — ติดต่อ Admin เพื่อขอเปิดสิทธิ์".
- Greeting: "สวัสดี {displayName} — เลือกบอร์ดที่ต้องการดู".
- **My boards** grid (cards). Empty state: "ยังไม่ได้รับสิทธิ์บอร์ดใด" / "ติดต่อ Admin เพื่อขอเปิดสิทธิ์บอร์ดแผนกของคุณ".
- **"เร็ว ๆ นี้"** section: coming-soon boards, disabled, with "กำลังพัฒนา".
- Board card = code · name · description:

| code | name | description | kind |
|---|---|---|---|
| PM | PM · Portfolio | Gantt · สถานะโครงการ · milestone | internal |
| QA | QA · Tester | บั๊ก · defect · คุณภาพงานเทส | external (full page load to `/qa/`) |
| CLEVEL | C-level · การเงิน | งบ · งวดเก็บเงิน · cash-flow | internal |
| BA | BA | requirement · analysis | coming soon |
| UX | UX/UI | design · usability | coming soon |

- An icon per board would help (designer's choice).

### 6.3 PM Portfolio — `/pm` — `03-pm-portfolio.png`, `04-pm-drilldown.png`, `09-pm-mobile.png`
Header: title "Project Portfolio — Executive Summary", eyebrow "UAT · Go-Live · Timeline · Status", As-of = last sync time, tagline.

**A. Toolbar**
- Filter "สถานะ:" — ทั้งหมด / On Track / At Risk / Delayed / Done / Waiting.
- Filter "โปรเจกต์:" — ทั้งหมด + one per project (display name).
- View toggle "มุมมอง:" — "ตามโปรเจกต์" (active) · "ตาม PM" (disabled; tooltip "รอ tag PM เจ้าของแต่ละโปรเจกต์ (blocked-on B7)").
- "รีเซ็ต" (when a filter is set).
- History picker "ย้อนหลัง:" (date, max today) + "ปัจจุบัน" link to return to live data.
- Stale-data badge (red): "ข้อมูลเก่ากว่า 24 ชม." (when the last sync is ≥ 24 h old).
- Button "Sync now" (busy: "กำลัง Sync…").

**B. History banner** (only when a past date is picked, amber):
- With data: "ดูข้อมูลย้อนหลัง ณ **{date}** (snapshot {date}) · overdue ไม่มีในข้อมูลย้อนหลัง".
- Without: "**ยังไม่มี snapshot ก่อน {date}** — ระบบเก็บ snapshot วันละครั้ง (17:00) เริ่มสะสมแล้ว".

**C. KPI row** (6 cards: label · big number · optional % of total)

| Label | Value | Click |
|---|---|---|
| โครงการทั้งหมด | total | clear status filter |
| UAT เดือนนี้ | count | — |
| Go-Live เดือนนี้ | count | — |
| On Track | count + % | filter On Track |
| At Risk | count + % | filter At Risk |
| Delayed | count + % | filter Delayed |

**D. "Project Timeline (Target vs Actual)"** — Gantt (the hero component)
- Legend: UAT (Target) · UAT (Actual) · Go-Live (Target) · Go-Live (Actual) · "วันนี้" (today line).
- Frozen left columns: `#` · Project (name, clickable → card drawer) · Progress (bar + %, "✎" when PM-overridden, tooltip "PM ปรับเอง", "—" when unknown) · Target Go-Live · Actual Go-Live · Status badge.
- Actual Go-Live cell: date; if later than target → red + "+N" (tooltip "Go-Live ช้ากว่า target N วัน"); not live yet but past target → red "เลย N วัน"; else "—".
- Status badge: On Track / At Risk / Delayed / Done / Waiting. Tooltip explains *why* ("{label} เพราะ: …reasons") or, when set by a PM, "PM ปรับเป็น {label} · ระบบคำนวณได้ {auto}". Consider a subtle visual marker for PM-set statuses (currently tooltip only).
- Timeline track: weekly grid, date ticks every 2 weeks, project bar start → go-live, 4 milestone markers (target = faint, actual = solid) with date tooltips, red today line. Horizontal scroll on narrow screens; needs an empty state.

**E. Three panels**
1. **"Milestones ที่จะถึง"** — rows: **{project}** · UAT/Go-Live … `{date} ({N} วัน)`; ≤7 days red, ≤14 amber. Empty: "ยังไม่มี UAT / Go-Live ข้างหน้า".
2. **"Projects by Status"** — donut (click slice = filter), centre total + "โครงการ"; legend: "On Track — ตามแผน", "At Risk — เสี่ยง (blocker/overdue/ใกล้ครบ<80%)", "Delayed — เลยกำหนด target Go-Live", "Waiting — รอเริ่ม (PM ตั้ง)" (+ Done). Empty "— ไม่มีข้อมูล".
3. **"CEO Attention Required"** (alert-tinted) — cards: project code · source pill AUTO/MANUAL · title · impact (red). Empty: "ไม่มีเรื่องค้างตัดสินใจ".

**F. "ความคืบหน้าย้อนหลัง"** — weekly progress line chart (one line per project, first 5), Y 0–100 %. Until enough data: placeholder "📈 เก็บข้อมูลมาแล้ว **N** สัปดาห์ — กราฟแนวโน้มจะสมบูรณ์เมื่อครบ M สัปดาห์".

**G. Card drawer** (opens from a project name; right-side sheet, full-screen on mobile)
- Title "การ์ดทั้งหมด" + project code · count "{n} ใบ" / "{filtered}/{total} ใบ" · close.
- **Budget box** (if any): "งบประมาณ" … "จ่ายแล้ว **{paid}** / {budget} ({burn}%)" + burn bar (red if >100 %) + installment list (name · amount · due date · "✓ จ่ายแล้ว" / "รอจ่าย") + note "แก้ไขงบ/งวด ที่หน้า Admin".
- Filter chips: "แผนก:" dept + count · "สถานะ:" bucket + count · "section: …" · "ล้าง filter".
- Card table: "ชื่อการ์ด" · "section" (click = filter) · "กำหนดส่ง" (red if overdue) · "เปิดใน Lark ↗".
- States: "กำลังโหลด…", "ผิดพลาด: …", empty table (add one).

**Page states:** loading "กำลังโหลด…" · error "โหลดข้อมูลไม่ได้: …" (design proper versions inside the shell).

### 6.4 Finance (C-level) — `/finance` — `05-finance.png`
Header: "Portfolio Financial — Executive", eyebrow "มูลค่างาน · การเก็บเงิน · กระแสเงินสด", tagline. (Adding the As-of date would be welcome.)

**A. Hero metrics (4)**

| Label | Value | Sub | Colour |
|---|---|---|---|
| มูลค่างานรวม | total contract value (฿) | — | neutral |
| เก็บเงินแล้ว | billed (฿) | "{n}% ของมูลค่างาน" | positive |
| ค้างเก็บ | outstanding (฿) | "ตั้งงวดแล้ว รอชำระ" | warning |
| ยังไม่ตั้งงวด | unplanned (฿) | "มูลค่างาน − งวดที่ตั้ง" | neutral |

**B. "กระแสเงินสดที่จะเข้า"** — 5 buckets, each: label · amount · "{n} งวด" · relative bar:
"เลยกำหนดแล้ว" (red) · "ภายใน 30 วัน" · "31 – 60 วัน" · "61 – 90 วัน" · "เกิน 90 วัน".

**C. "เงินที่เสี่ยง / ต้องตามเก็บ"** — "Revenue at risk · งวดผูกกับโครงการที่ล่าช้า" big red amount + "{n} งวด"; sub-list "งวดเลยกำหนดชำระ": `{code}` · {installment} … amount + "เลย N วัน". Empty "ไม่มีงวดค้างเก็บ".

**D. "การเงินรายโครงการ"** table — โครงการ · สถานะ (dot + label) · มูลค่างาน · เก็บแล้ว · ค้างเก็บ · burn % · footer "รวมทั้งหมด". Needs an empty state.

Money format: `1,500,000 ฿` (Thai locale). Loading/error states as in 6.3.

### 6.5 Settings — `/admin` — `06-admin-projects.png`, `07-admin-section-rules.png`, `08-admin-users.png`
Header: "ตั้งค่าระบบ", eyebrow "Settings · Projects · Section Rules · Users". Visible to ADMIN and PM.

**A. Lark connection card (ADMIN only, above tabs)**
- Title "การเชื่อมต่อ Lark (token ETL)"; normal text "ใช้เมื่อ sync แจ้งว่าต้อง authorize ใหม่ · login Lark ด้วยบัญชีที่เห็นทุกบอร์ด".
- Warning state: "⚠️ token หมดอายุ — sync ดึงข้อมูลไม่ได้ ต้องเชื่อม Lark ใหม่".
- Button "เชื่อม Lark ใหม่".
- Result banners: success "เชื่อม Lark สำเร็จ — กด Sync now ที่ Dashboard เพื่อดึงข้อมูลรอบใหม่" · failure "เชื่อม Lark ไม่สำเร็จ — ลองกดใหม่อีกครั้ง (ถ้ายังไม่ได้ ดู server log)".

**B. Tabs:** "โครงการ · Milestone" · "Section Rules" · "ผู้ใช้" (ADMIN only). Each tab has a message toast area.

**Tab 1 — "โครงการ · Milestone"**
- "+ เพิ่มโครงการ" → form "เพิ่มโครงการใหม่": Project Code * (auto UPPER_SNAKE) · "ชื่อแสดง (ว่าง = ใช้ code)" · "Lark tasklist_guid *" (monospace) · hint "ก็อบ guid จาก URL บอร์ด Lark · ข้าวต้องเป็นสมาชิกบอร์ดนั้น" · "เพิ่ม + ทดสอบ" / "ยกเลิก".
- Per project: name (+ show project code) · override indicator "override {status} · {progress}%" · actions "ทดสอบการเชื่อมต่อ", "Override สถานะ" (status: ON_TRACK / AT_RISK / DELAYED / DONE / WAITING + reason ≥ 10 chars), "Override progress" (0–100 + reason) · date fields Start / Target UAT / Actual UAT / Target Go-Live / Actual Go-Live (save on blur) · "งบประมาณ (บาท)".
- Installments editor ("จัดการงวดการเงิน →"): header "งวดการเงิน · จ่ายแล้ว {paid} / {budget} ({burn}%)" · rows name · amount · due · paid toggle ("จ่ายแล้ว"/"รอจ่าย") · delete · add row (name "ชื่องวด (งวด 1 · มัดจำ)", amount, date, "เพิ่ม") · "ปิด".
- Needs loading & empty states.

**Tab 2 — "Section Rules"** (maps Lark board sections → department / bucket / weight)
- Red box "{n} section ยังไม่ได้ map" with chips "{project|global} · {section} ({cards})" → click pre-fills the form.
- "+ เพิ่ม rule" form "เพิ่ม / map section rule": บอร์ด (global / project) · match (EXACT / CONTAINS / FALLBACK) · pattern · priority · dept (PM / BA / UXUI / DEV / QA / NONE) · bucket (BACKLOG / IN_PROGRESS / WAITING / DONE / BLOCKED) · weight 0–100 · "บันทึก + recompute" / "ยกเลิก".
- Rules table: scope · pattern · dept (inline select) · bucket (inline select) · weight (inline number) · pri · "ลบ". Inactive rules dimmed. Busy "กำลัง recompute…". Result toast "{action} · อัพเดต {n} ใบ · unmapped เหลือ {m}".

**Tab 3 — "ผู้ใช้"** (ADMIN only)
- Intro "คนที่อยู่ในรายการนี้ (และเปิดใช้งาน) เท่านั้นที่ login ด้วย Lark ได้ · ใช้อีเมลเดียวกับบัญชี Lark ของบริษัท".
- "+ เพิ่มผู้ใช้" form: "อีเมล Lark" · "ชื่อ (ไม่ใส่ก็ได้)" · "สิทธิ์" (ADMIN — ทุกอย่าง + จัดการผู้ใช้ / PM — ดู + ตั้งค่าโครงการ / VIEWER — ดูอย่างเดียว) · "บอร์ดที่เข้าได้" checkboxes (hidden for ADMIN).
- Table: อีเมล (+ "(คุณ)") · ชื่อ (inline edit) · สิทธิ์ (select; locked on own row) · บอร์ด ("ทุกบอร์ด" for ADMIN, else checkboxes PM/QA/CLEVEL) · Lark ("ผูกแล้ว" / "ยังไม่เคย login") · action "ปิดใช้งาน" / "เปิดใช้งาน" (hidden on own row). Inactive users dimmed.

---

## 7. Shared components to design

App shell · Page header · Nav (desktop + mobile) · KPI card (tones: neutral, info, on-track, at-risk, delayed, waiting) · Section card/panel · Status badge (5 statuses, + "set by PM" variant) · Filter bar (selects, segmented control, date picker, reset) · Buttons (primary, secondary, ghost, danger, link) · Gantt timeline · Donut chart · Line chart · Money/percent/date formatting · Data table (sticky header, totals row, inline edit cells) · Side drawer · Chips (filter/toggle) · Banner (info / warning / danger) · Toast · Modal dialog (override, confirm) · Form fields (text, number, date, select, checkbox group) · Tabs · Empty / loading (skeleton) / error / forbidden states · Board card (active / external / coming soon).

## 8. Current design tokens (starting point — you may redefine)

- **Status (semantic, keep the meaning):** On Track `#16a34a` · At Risk `#f59e0b` · Delayed `#dc2626` · Done `#16a34a` (may get its own colour) · Waiting `#9ca3af` · In progress / info `#2563eb` · neutral slate `#64748b`.
- **Brand header:** navy `#1e3a5f`. Background `slate-100`, text `slate-800`.
- **Font:** Sarabun 400/500/600/700.
- **Formats:** dates `16 Sep 25` (`d MMM yy`), date-time `24 Sep 10:22`, money `1,500,000 ฿`, percent `33%`, missing values `—` (never show 0 for "no data").

## 9. Deliverables requested from Claude Design

1. **Design system:** colour tokens (light; dark optional), type scale, spacing, radius, shadows, iconography, status palette — as Tailwind config values.
2. **Every screen in §6** at desktop (1440) and mobile (390): Login + Forbidden · Board picker · PM Portfolio (+ history banner + stale badge + card drawer) · Finance · Settings (Lark card + 3 tabs + add forms + installment editor + override dialog).
3. **States** for each: loading, empty, error, no-permission.
4. **Components** from §7 with variants.
5. Code output as **React + Tailwind** components/pages where possible (Recharts for charts), so Claude Code can wire them to the existing API with minimal translation.

## 10. Handoff back to Claude Code

Export/download the result (zip of HTML/React, or a shareable link) and give it to Claude Code with: *"Implement this design in `web/` — keep `lib/api.ts`, `lib/types.ts` and all behaviour unchanged."* Claude Code will re-skin every page, keep all data wiring, and verify each screen with screenshots before opening a PR.

---

### Suggested prompt for Claude Design

> Redesign every screen of this internal project-portfolio portal using the attached brief (`DESIGN-BRIEF.md`) and the current screenshots. Keep every data point, control, state and Thai UI string listed in section 6 — only the visual design, layout and hierarchy should change. Audience: CEO/CFO (glanceable) and PMs (editing). Style: premium, calm, executive; red only for problems. Deliver a design system (Tailwind tokens) plus all screens at 1440 px and 390 px, including loading/empty/error states, as React + Tailwind components. Use fictional project names only.
