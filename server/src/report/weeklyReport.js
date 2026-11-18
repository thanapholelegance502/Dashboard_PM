// รายงานสรุปรายสัปดาห์ของบอร์ด PM (KHAW) — model → HTML (A4) / เนื้ออีเมล / หัวเรื่อง
// pure ทั้งไฟล์: ไม่แตะ DB ไม่แตะ Chromium → test ได้ใน test:ci
// input = getPmBoardSummary() ชุดเดียวกับหน้า /pm (MASTER §12.2)
import { html, raw, esc } from './html.js';
import { fmtDate, fmtDateTime, isoDateBkk, workWeekRange } from './thaiFormat.js';
import { donutSvg, STATUS_COLOR } from './donutSvg.js';

const STATUS_LABEL = { ON_TRACK: 'On Track', AT_RISK: 'At Risk', DELAYED: 'Delayed', DONE: 'Done', WAITING: 'Waiting' };
const STALE_MS = 24 * 60 * 60 * 1000; // เกณฑ์เดียวกับ /api/sync/status

/**
 * ข้อมูลสดพอไหม
 * expectSince = เวลาที่ sync ควรสำเร็จหลังจากนั้น (cron ศุกร์ส่ง "วันนี้ 17:00") · ไม่ส่ง = ใช้เกณฑ์ 24 ชม. เหมือนบนจอ
 */
export function classifyFreshness(sync, now, { expectSince = null } = {}) {
  const ok = sync?.lastSuccess;
  if (!ok || !ok.finishedAt) {
    return { level: 'stale', text: 'ยังไม่เคย sync ข้อมูลจาก Lark สำเร็จ — ตัวเลขในรายงานนี้ยังใช้ไม่ได้' };
  }
  const at = new Date(ok.finishedAt);
  const stale = expectSince ? at < new Date(expectSince) : now - at > STALE_MS;
  if (stale) {
    return { level: 'stale', text: `ข้อมูล ณ ${fmtDateTime(at)} — sync รอบล่าสุดไม่สำเร็จ ตัวเลขอาจไม่ล่าสุด` };
  }
  if (ok.status === 'PARTIAL') {
    return { level: 'partial', text: `sync รอบล่าสุดดึงไม่ครบ ${ok.projectsFail ?? ''} โครงการ — ตัวเลขของโครงการนั้นเป็นข้อมูลรอบก่อน` };
  }
  return { level: 'ok', text: null };
}

/** สร้าง model ที่ HTML/อีเมลใช้ร่วมกัน */
export function buildReportModel(summary, { baseUrl, now = new Date(), expectSince = null, note = null } = {}) {
  const base = String(baseUrl ?? '').replace(/\/+$/, '');
  const p = summary.portfolio;
  // แยก Done ออกจากตารางหลัก (projects มาเรียง sortByPain แล้ว → Done อยู่ท้าย)
  const active = p.projects.filter((r) => r.status !== 'DONE');
  const done = p.projects.filter((r) => r.status === 'DONE');
  return {
    title: 'Project Executive (KHAW)',
    weekRange: workWeekRange(now),
    generatedAt: now,
    dataAt: summary.sync?.lastSuccess?.finishedAt ?? p.lastSyncAt ?? null,
    freshness: classifyFreshness(summary.sync, now, { expectSince }),
    kpis: p.kpis,
    projects: p.projects, // ครบ (เผื่อใช้ที่อื่น)
    activeProjects: active,
    doneProjects: done,
    note: {
      summary: note?.summary ?? '',
      issues: note?.issues ?? '',
      outOfScope: note?.outOfScope ?? '',
    },
    statusBreakdown: summary.statusBreakdown,
    attention: summary.attention.items,
    milestones: summary.milestones.items,
    links: {
      board: `${base}/pm`,
      project: (code) => `${base}/pm?drill=${encodeURIComponent(code)}`,
    },
  };
}

/** โน้ต 3 ช่อง (PM พิมพ์) → หน้า 1 · ว่าง = "—" (ไม่ซ่อนหัวข้อ) · ขึ้นบรรทัดใหม่ได้ · escape เสมอ */
function noteSection(m) {
  const block = (label, text) => {
    const t = String(text ?? '').trim();
    const body = t ? raw(esc(t).replace(/\n/g, '<br>')) : html`<span class="muted">—</span>`;
    return html`<div class="note-b"><div class="note-l">${label}</div><div class="note-t">${body}</div></div>`;
  };
  return html`<div class="notes">
    ${block('สรุปภาพรวม', m.note.summary)}
    ${block('ปัญหาและอุปสรรค', m.note.issues)}
    ${block('งานนอก scope ที่ทำเพิ่มเติม', m.note.outOfScope)}
  </div>`;
}

const KPI_DEFS = [
  ['total', 'โครงการทั้งหมด'],
  ['uatThisMonth', 'UAT เดือนนี้'],
  ['goliveThisMonth', 'Go-Live เดือนนี้'],
  ['onTrack', 'On Track'],
  ['atRisk', 'At Risk'],
  ['delayed', 'Delayed'],
  ['waiting', 'Waiting'],
];

function kpiTiles(m) {
  return KPI_DEFS.map(([k, label]) => {
    const problem = (k === 'delayed' || k === 'atRisk') && m.kpis[k] > 0;
    return html`<div class="kpi${problem ? ' kpi-bad' : ''}"><div class="kpi-l">${label}</div><div class="kpi-v">${m.kpis[k]}</div></div>`;
  });
}

function statusPill(s) {
  return html`<span class="pill" style="${raw(`color:${STATUS_COLOR[s] ?? '#4A4E57'}`)}">● ${STATUS_LABEL[s] ?? s}</span>`;
}

function attentionList(m) {
  if (!m.attention.length) return html`<p class="empty">ไม่มีเรื่องค้างตัดสินใจ</p>`;
  return html`<table class="tbl"><thead><tr><th>โครงการ</th><th>เรื่อง</th><th>ผลกระทบ</th><th class="r">ต้องการภายใน</th></tr></thead><tbody>${m.attention.map(
    (a) => html`<tr>
      <td class="code"><a href="${m.links.project(a.project?.projectCode ?? '')}">${a.project?.projectCode ?? '—'}</a></td>
      <td>${a.title}<div class="sub">${a.source} · ${a.issueType}</div></td>
      <td class="bad">${a.impactText}</td>
      <td class="r">${fmtDate(a.neededBy)}</td>
    </tr>`,
  )}</tbody></table>`;
}

function milestoneList(m) {
  if (!m.milestones.length) return html`<p class="empty">ยังไม่มี UAT / Go-Live ข้างหน้า</p>`;
  return html`<table class="tbl"><tbody>${m.milestones.map(
    (x) => html`<tr>
      <td class="code"><a href="${m.links.project(x.code)}">${x.code}</a></td>
      <td>${x.type === 'GO_LIVE' ? 'Go-Live' : 'UAT'}</td>
      <td class="r${x.inDays <= 7 ? ' bad' : ''}">${fmtDate(x.date)} (${x.inDays} วัน)</td>
    </tr>`,
  )}</tbody></table>`;
}

function legend(m) {
  return m.statusBreakdown.map(
    (b) => html`<div class="lg"><span class="dot" style="${raw(`background:${STATUS_COLOR[b.status] ?? '#7A7F88'}`)}"></span>${STATUS_LABEL[b.status] ?? b.status}<b>${b.count}</b></div>`,
  );
}

function projectTable(rows, m, { empty = 'ยังไม่มีโครงการ' } = {}) {
  if (!rows.length) return html`<p class="empty">${empty}</p>`;
  return html`<table class="tbl proj"><thead><tr>
      <th>โครงการ</th><th>สถานะ</th><th class="r">คืบหน้า</th>
      <th class="r">Target UAT</th><th class="r">Target Go-Live</th><th class="r">ช้า</th>
    </tr></thead><tbody>${rows.map((p) => {
      const pct = p.progressPct == null ? null : Math.max(0, Math.min(100, Math.round(p.progressPct)));
      return html`<tr>
        <td><a class="code" href="${m.links.project(p.code)}">${p.code}</a><div class="sub">${p.displayName}</div>
          ${p.statusReasons?.length ? html`<div class="sub why">${p.statusReasons[0]}</div>` : ''}</td>
        <td>${statusPill(p.status)}${p.statusSource === 'OVERRIDE' ? html`<span class="sub"> *</span>` : ''}</td>
        <td class="r">${pct == null ? '—' : html`<div class="bar"><i style="${raw(`width:${pct}%`)}"></i></div>${pct}%`}</td>
        <td class="r">${fmtDate(p.actualUat ?? p.targetUat)}${p.actualUat ? html`<div class="sub">เสร็จแล้ว</div>` : ''}</td>
        <td class="r">${fmtDate(p.actualGolive ?? p.targetGolive)}${p.actualGolive ? html`<div class="sub">เสร็จแล้ว</div>` : ''}</td>
        <td class="r${p.slipDays > 0 ? ' bad' : ''}">${p.slipDays > 0 ? `${p.slipDays} วัน` : '—'}</td>
      </tr>`;
    })}</tbody></table>
    <p class="note">* สถานะตั้งเองโดย PM (override) · คืบหน้า = ถ่วงน้ำหนักตาม section ของการ์ดใน Lark</p>`;
}

const CSS = `
@page { size: A4; margin: 12mm 12mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'IBM Plex Sans Thai', 'Sarabun', 'Loma', sans-serif; color: #1B1D22; font-size: 10.5pt; line-height: 1.45; margin: 0; }
a { color: #22406B; text-decoration: none; }
h1 { font-size: 17pt; margin: 0; letter-spacing: -0.01em; }
h2 { font-size: 11.5pt; margin: 14px 0 6px; }
.head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #16263F; padding-bottom: 8px; }
.eyebrow { font-size: 8.5pt; color: #7A7F88; letter-spacing: 0.04em; }
.meta { text-align: right; font-size: 8.5pt; color: #4A4E57; }
.banner { margin: 10px 0 0; padding: 7px 10px; border-radius: 6px; font-size: 9.5pt; }
.banner.stale { background: #FBEAE8; color: #B42F26; border: 1px solid #F0C9C4; }
.banner.partial { background: #FBF3E0; color: #9A6A0C; border: 1px solid #EBD9A8; }
.kpis { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 12px; }
.kpi { border: 1px solid #E2DFD8; border-radius: 6px; padding: 6px 7px; }
.kpi-bad { border-color: #F0C9C4; }
.kpi-l { font-size: 7.5pt; color: #4A4E57; }
.kpi-v { font-size: 17pt; font-weight: 600; line-height: 1.1; }
.kpi-bad .kpi-v { color: #B42F26; }
.row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; }
.donut { display: flex; align-items: center; gap: 12px; }
.lg { display: flex; align-items: center; gap: 6px; font-size: 9pt; margin: 2px 0; }
.lg b { margin-left: auto; padding-left: 12px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.tbl { width: 100%; border-collapse: collapse; font-size: 9pt; }
.tbl th { text-align: left; font-weight: 500; color: #7A7F88; font-size: 8pt; border-bottom: 1px solid #E2DFD8; padding: 4px 5px; }
.tbl td { border-bottom: 1px solid #F3F1EC; padding: 5px; vertical-align: top; }
.tbl tr { break-inside: avoid; }
.r { text-align: right; white-space: nowrap; }
.code { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 8.5pt; color: #4A4E57; }
.sub { font-size: 8pt; color: #7A7F88; }
.why { color: #9A6A0C; }
.bad { color: #B42F26; font-weight: 600; }
.pill { font-size: 8.5pt; white-space: nowrap; }
.bar { display: inline-block; width: 52px; height: 5px; background: #F1EFEA; border-radius: 3px; margin-right: 5px; vertical-align: middle; overflow: hidden; }
.bar i { display: block; height: 100%; background: #22406B; }
.empty { color: #7A7F88; font-size: 9pt; margin: 4px 0; }
.note { font-size: 7.5pt; color: #7A7F88; margin-top: 6px; }
.live { font-size: 8pt; font-weight: 400; margin-left: 6px; }
h2.first { margin-top: 12px; }
.notes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 2px 0 4px; }
.note-b { border: 1px solid #E2DFD8; border-left: 3px solid #22406B; border-radius: 6px; padding: 7px 9px; break-inside: avoid; }
.note-l { font-size: 8pt; font-weight: 600; color: #22406B; margin-bottom: 3px; }
.note-t { font-size: 9pt; line-height: 1.4; white-space: normal; }
.muted { color: #9CA0A8; }
.done-h { margin-top: 16px; color: #4A4E57; }
`;

/** HTML ฉบับ A4 สำหรับ Chromium → PDF · fontCss = @font-face ที่ฝังฟอนต์ (ว่างได้ตอนเทส) */
export function renderReportHtml(m, { fontCss = '' } = {}) {
  const banner = m.freshness.level !== 'ok'
    ? html`<div class="banner ${m.freshness.level}">⚠ ${m.freshness.text}</div>`
    : '';
  const body = html`<!doctype html><html lang="th"><head><meta charset="utf-8">
<title>${m.title} — สรุปประจำสัปดาห์ ${m.weekRange}</title>
<style>${raw(fontCss)}${raw(CSS)}</style></head><body>
<div class="head">
  <div><div class="eyebrow">ELEGANCE PMO · สรุปประจำสัปดาห์</div><h1>${m.title}</h1><div>${m.weekRange}</div></div>
  <div class="meta">ข้อมูล ณ ${fmtDateTime(m.dataAt)}<br>สร้างรายงาน ${fmtDateTime(m.generatedAt)}<br><a href="${m.links.board}">เปิดแดชบอร์ดสด →</a></div>
</div>
${banner}
<h2 class="first">สรุปจากผู้จัดการโครงการ</h2>
${noteSection(m)}
<div class="kpis">${kpiTiles(m)}</div>
<div class="row">
  <div><h2>CEO Attention Required <a class="live" href="${m.links.board}">ดูสด →</a></h2>${attentionList(m)}</div>
  <div><h2>Projects by Status</h2><div class="donut">${raw(donutSvg(m.statusBreakdown))}<div>${legend(m)}</div></div>
    <h2>Milestones ที่จะถึง</h2>${milestoneList(m)}</div>
</div>
<h2>โครงการ (เรียงตามความเดือดร้อน) <a class="live" href="${m.links.board}">ดูสด →</a></h2>
${projectTable(m.activeProjects, m, { empty: 'ไม่มีโครงการที่กำลังดำเนินการ' })}
${m.doneProjects.length ? html`<h2 class="done-h">โครงการที่เสร็จแล้ว (${m.doneProjects.length})</h2>${projectTable(m.doneProjects, m)}` : ''}
</body></html>`;
  return body.value;
}

/** หัวเรื่องอีเมล — test ส่งมีป้าย [ทดสอบ] นำหน้า */
export function buildSubject(m, { test = false } = {}) {
  return `${test ? '[ทดสอบ] ' : ''}[PMO] สรุปโครงการประจำสัปดาห์ ${m.weekRange} · ${m.title}`;
}

/** ชื่อไฟล์แนบ (ASCII ล้วน — บางเมลไคลเอนต์ทำชื่อไทยเพี้ยน) */
export function reportFilename(m) {
  return `PMO-KHAW-${isoDateBkk(m.generatedAt)}.pdf`;
}

/** เนื้ออีเมลแบบ HTML (inline style — Gmail ตัด <style>) */
export function renderEmailHtml(m) {
  const top = m.attention.slice(0, 3);
  const banner = m.freshness.level !== 'ok'
    ? html`<p style="background:#FBEAE8;color:#B42F26;padding:8px 10px;border-radius:6px">⚠ ${m.freshness.text}</p>`
    : '';
  const cell = 'padding:6px 10px;border:1px solid #E2DFD8;text-align:center';
  return html`<div style="font-family:'IBM Plex Sans Thai',Tahoma,sans-serif;color:#1B1D22;font-size:14px;line-height:1.5">
<p>เรียนทุกท่าน</p>
<p>สรุปสถานะโครงการประจำสัปดาห์ <b>${m.weekRange}</b> · ${m.title}<br>
<span style="color:#7A7F88;font-size:12px">ข้อมูล ณ ${fmtDateTime(m.dataAt)}</span></p>
${banner}
<table style="border-collapse:collapse;margin:8px 0"><tr>${KPI_DEFS.map(([, l]) => html`<td style="${raw(`${cell};font-size:11px;color:#4A4E57`)}">${l}</td>`)}</tr>
<tr>${KPI_DEFS.map(([k]) => html`<td style="${raw(`${cell};font-size:18px;font-weight:600`)}">${m.kpis[k]}</td>`)}</tr></table>
<p><b>CEO Attention (${m.attention.length})</b></p>
${top.length ? html`<ul>${top.map((a) => html`<li><code>${a.project?.projectCode ?? ''}</code> ${a.title} — <span style="color:#B42F26">${a.impactText}</span></li>`)}</ul>` : html`<p style="color:#7A7F88">ไม่มีเรื่องค้างตัดสินใจ</p>`}
<p><a href="${m.links.board}" style="display:inline-block;background:#22406B;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">เปิดแดชบอร์ดสด</a></p>
<p>รายละเอียดเต็มอยู่ในไฟล์แนบ PDF</p>
<p style="color:#7A7F88;font-size:12px">อีเมลอัตโนมัติจาก Elegance PMO Portal</p>
</div>`.value;
}

/** เนื้ออีเมลแบบข้อความล้วน (เมลไคลเอนต์ที่ไม่แสดง HTML) */
export function renderEmailText(m) {
  const lines = [
    'เรียนทุกท่าน',
    '',
    `สรุปสถานะโครงการประจำสัปดาห์ ${m.weekRange} · ${m.title}`,
    `ข้อมูล ณ ${fmtDateTime(m.dataAt)}`,
  ];
  if (m.freshness.level !== 'ok') lines.push('', `⚠ ${m.freshness.text}`);
  lines.push('', ...KPI_DEFS.map(([k, l]) => `- ${l}: ${m.kpis[k]}`));
  lines.push('', `CEO Attention: ${m.attention.length} เรื่อง`);
  for (const a of m.attention.slice(0, 3)) lines.push(`- ${a.project?.projectCode ?? ''} ${a.title} — ${a.impactText}`);
  lines.push('', `เปิดแดชบอร์ดสด: ${m.links.board}`, 'รายละเอียดเต็มอยู่ในไฟล์แนบ PDF');
  return lines.join('\n');
}

export { esc };
