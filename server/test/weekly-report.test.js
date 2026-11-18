// ‼️ fixture ชื่อสมมติ · อีเมล example.com เท่านั้น (repo public — MASTER §12.5)
import { describe, it, expect } from 'vitest';
import {
  buildReportModel, renderReportHtml, renderEmailHtml, renderEmailText, buildSubject, reportFilename, classifyFreshness,
} from '../src/report/weeklyReport.js';
import { esc, html, raw } from '../src/report/html.js';
import { workWeekRange, fmtDate } from '../src/report/thaiFormat.js';
import { donutSvg } from '../src/report/donutSvg.js';

const now = new Date('2026-11-20T10:30:00Z'); // ศุกร์ 17:30 กรุงเทพ
const BASE = 'https://pmo.example.com';
const okSync = { lastSuccess: { status: 'SUCCESS', finishedAt: new Date('2026-11-20T10:02:00Z'), projectsFail: 0 } };

function summary(over = {}) {
  return {
    portfolio: {
      lastSyncAt: okSync.lastSuccess.finishedAt,
      kpis: { total: 6, onTrack: 2, atRisk: 1, delayed: 2, waiting: 1, uatThisMonth: 3, goliveThisMonth: 4 },
      projects: [
        { code: 'PRJ_ALPHA', displayName: 'Alpha', status: 'DELAYED', statusSource: 'AUTO', statusReasons: ['เลยกำหนด 5 วัน'], progressPct: 56, targetUat: '2026-10-08', targetGolive: '2026-11-07', slipDays: 11 },
        { code: 'PRJ_BETA', displayName: 'Beta', status: 'ON_TRACK', statusSource: 'OVERRIDE', statusReasons: [], progressPct: null, slipDays: null },
      ],
    },
    attention: { items: [{ title: 'อนุมัติงบ', impactText: '1 งวด · ฿600,000', source: 'AUTO', issueType: 'DECISION', neededBy: '2026-11-25', project: { projectCode: 'PRJ_ALPHA' } }] },
    milestones: { items: [{ code: 'PRJ_BETA', type: 'GO_LIVE', date: '2026-11-24', inDays: 4 }] },
    statusBreakdown: [{ status: 'ON_TRACK', count: 2 }, { status: 'DELAYED', count: 2 }],
    sync: okSync,
    ...over,
  };
}

const model = (s = summary(), opts = {}) => buildReportModel(s, { baseUrl: BASE, now, ...opts });

describe('html — escape ข้อความจาก Lark', () => {
  it('esc แปลงอักขระพิเศษครบ', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(esc(null)).toBe('');
  });
  it('html`` escape ทุกค่า ยกเว้น raw() และ html ซ้อน', () => {
    const inner = html`<b>${'<i>'}</b>`;
    expect(html`<p>${'<script>'}${inner}${raw('<br>')}</p>`.value).toBe('<p>&lt;script&gt;<b>&lt;i&gt;</b><br></p>');
  });
});

describe('renderReportHtml', () => {
  const out = renderReportHtml(model());

  it('มีตัวเลข KPI ครบทั้ง 7 ใบ (เลขเดียวกับบนจอ)', () => {
    for (const label of ['โครงการทั้งหมด', 'UAT เดือนนี้', 'Go-Live เดือนนี้', 'On Track', 'At Risk', 'Delayed', 'Waiting']) {
      expect(out).toContain(label);
    }
    expect(out).toMatch(/โครงการทั้งหมด<\/div><div class="kpi-v">6</);
    expect(out).toMatch(/Go-Live เดือนนี้<\/div><div class="kpi-v">4</);
  });

  it('‼️ ชื่อโครงการ/หัวข้อจาก Lark ที่มี HTML ออกมาเป็นตัวอักษร', () => {
    const evil = summary();
    evil.portfolio.projects[0].displayName = '<img src=x onerror=alert(1)>';
    evil.attention.items[0].title = '</style><script>alert(1)</script>';
    const h = renderReportHtml(model(evil));
    expect(h).not.toContain('<img src=x');
    expect(h).not.toContain('<script>alert');
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(h).toContain('&lt;/style&gt;&lt;script&gt;');
  });

  it('‼️ ลิงก์ทุกตัวชี้กลับ dashboard จริง (§12.1) และ encode รหัสโครงการ', () => {
    const hrefs = [...out.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h.startsWith(`${BASE}/pm`), h).toBe(true);
    const weird = summary();
    weird.portfolio.projects[0].code = 'A&B "x"';
    expect(renderReportHtml(model(weird))).toContain(`${BASE}/pm?drill=A%26B%20%22x%22`);
  });

  it('ข้อมูลสด → ไม่มี banner เตือน', () => {
    expect(out).not.toContain('class="banner');
  });

  it('สถานะ override ติดดอกจัน · ไม่มีความคืบหน้า = — ไม่ใช่ 0%', () => {
    expect(out).toMatch(/On Track<\/span><span class="sub"> \*<\/span>/);
    expect(out).not.toContain('>0%');
  });
});

describe('โน้ต 3 ช่อง (หน้า 1) — PM พิมพ์ → ลง PDF', () => {
  it('แสดงหัวข้อครบ 3 ช่อง + เนื้อหาที่พิมพ์', () => {
    const h = renderReportHtml(model(summary(), { note: { summary: 'คืบหน้าดี', issues: 'รอ UAT ลูกค้า', outOfScope: 'ทำ hotfix ให้' } }));
    for (const label of ['สรุปภาพรวม', 'ปัญหาและอุปสรรค', 'งานนอก scope ที่ทำเพิ่มเติม']) expect(h).toContain(label);
    expect(h).toContain('คืบหน้าดี');
    expect(h).toContain('รอ UAT ลูกค้า');
    expect(h).toContain('ทำ hotfix ให้');
  });
  it('ช่องว่าง → "—" ไม่ซ่อนหัวข้อ', () => {
    const h = renderReportHtml(model(summary(), { note: { summary: 'มีแต่อันนี้', issues: '', outOfScope: '' } }));
    expect(h).toContain('ปัญหาและอุปสรรค');
    expect(h).toContain('class="muted">—');
  });
  it('‼️ escape โน้ตที่มี HTML + ขึ้นบรรทัดใหม่เป็น <br>', () => {
    const h = renderReportHtml(model(summary(), { note: { summary: '<b>hack</b>\nบรรทัดสอง', issues: '', outOfScope: '' } }));
    expect(h).not.toContain('<b>hack</b>');
    expect(h).toContain('&lt;b&gt;hack&lt;/b&gt;<br>บรรทัดสอง');
  });
  it('ไม่ส่ง note → 3 ช่องเป็น "—" (ไม่ระเบิด)', () => {
    const h = renderReportHtml(model());
    expect(h).toContain('สรุปภาพรวม');
    expect((h.match(/class="muted">—/g) ?? []).length).toBe(3);
  });
});

describe('แยกงานเสร็จออกจากตารางหลัก (PDF)', () => {
  const withDone = () => {
    const s = summary();
    s.portfolio.projects = [
      { code: 'PRJ_LATE', displayName: 'Late', status: 'DELAYED', statusSource: 'AUTO', statusReasons: [], progressPct: 40, slipDays: 9 },
      { code: 'PRJ_FIN', displayName: 'Fin', status: 'DONE', statusSource: 'AUTO', statusReasons: [], progressPct: 100, slipDays: null },
    ];
    return s;
  };
  it('มีหัวข้อ "โครงการที่เสร็จแล้ว (N)" เมื่อมี Done', () => {
    expect(renderReportHtml(model(withDone()))).toContain('โครงการที่เสร็จแล้ว (1)');
  });
  it('Done อยู่หลังตารางหลัก (ท้ายเอกสาร)', () => {
    const h = renderReportHtml(model(withDone()));
    expect(h.indexOf('PRJ_FIN')).toBeGreaterThan(h.indexOf('PRJ_LATE'));
    expect(h.indexOf('โครงการที่เสร็จแล้ว')).toBeGreaterThan(h.indexOf('PRJ_LATE'));
  });
  it('ไม่มี Done → ไม่มีหัวข้อ "เสร็จแล้ว"', () => {
    expect(renderReportHtml(model())).not.toContain('โครงการที่เสร็จแล้ว');
  });
  it('ไม่บังคับขึ้นหน้าใหม่ (เอา break-before: page ออกจากตารางโครงการ)', () => {
    expect(renderReportHtml(model())).not.toContain('proj-h');
  });
});

describe('classifyFreshness — ข้อมูลสดพอไหม', () => {
  it('ไม่เคย sync สำเร็จ → stale', () => {
    expect(classifyFreshness({ lastSuccess: null }, now).level).toBe('stale');
  });
  it('cron ศุกร์: sync สำเร็จหลัง 17:00 วันนี้ → ok · ก่อนนั้น → stale พร้อมเวลา', () => {
    const since = new Date('2026-11-20T09:50:00Z'); // 16:50 ไทย
    expect(classifyFreshness(okSync, now, { expectSince: since }).level).toBe('ok');
    const old = { lastSuccess: { status: 'SUCCESS', finishedAt: new Date('2026-11-20T01:05:00Z') } };
    const r = classifyFreshness(old, now, { expectSince: since });
    expect(r.level).toBe('stale');
    expect(r.text).toContain('20 พ.ย. 69');
  });
  it('กดปุ่มระหว่างวัน: ใช้เกณฑ์ 24 ชม. เหมือนบนจอ (sync เช้าวันนี้ไม่ถือว่าเก่า)', () => {
    const morning = { lastSuccess: { status: 'SUCCESS', finishedAt: new Date('2026-11-20T01:05:00Z') } };
    expect(classifyFreshness(morning, now).level).toBe('ok');
  });
  it('PARTIAL → เตือนสีส้ม · banner ขึ้นในรายงาน', () => {
    const partial = { lastSuccess: { status: 'PARTIAL', finishedAt: okSync.lastSuccess.finishedAt, projectsFail: 2 } };
    expect(classifyFreshness(partial, now).level).toBe('partial');
    expect(renderReportHtml(model(summary({ sync: partial })))).toContain('class="banner partial"');
  });
});

describe('อีเมล', () => {
  const m = model();
  it('หัวเรื่องมีช่วงสัปดาห์ · ส่งทดสอบมีป้าย [ทดสอบ]', () => {
    expect(buildSubject(m)).toBe('[PMO] สรุปโครงการประจำสัปดาห์ 16–20 พ.ย. 69 · Project Executive (KHAW)');
    expect(buildSubject(m, { test: true }).startsWith('[ทดสอบ] ')).toBe(true);
  });
  it('ชื่อไฟล์แนบเป็น ASCII ตามวันที่กรุงเทพ', () => {
    expect(reportFilename(m)).toBe('PMO-KHAW-2026-11-20.pdf');
  });
  it('เนื้ออีเมล HTML + ข้อความล้วนมีลิงก์ dashboard และ KPI', () => {
    const h = renderEmailHtml(m);
    expect(h).toContain(`href="${BASE}/pm"`);
    expect(h).toContain('อนุมัติงบ');
    const t = renderEmailText(m);
    expect(t).toContain(`${BASE}/pm`);
    expect(t).toContain('- โครงการทั้งหมด: 6');
  });
  it('เนื้ออีเมล escape หัวข้อจาก Lark ด้วย', () => {
    const s = summary();
    s.attention.items[0].title = '<b onclick=x>';
    expect(renderEmailHtml(model(s))).not.toContain('<b onclick');
  });
});

describe('thaiFormat / donut', () => {
  it('ช่วงสัปดาห์จันทร์–ศุกร์ · วันเสาร์/อาทิตย์นับเป็นสัปดาห์ที่เพิ่งจบ', () => {
    expect(workWeekRange(now)).toBe('16–20 พ.ย. 69');
    expect(workWeekRange(new Date('2026-11-22T05:00:00Z'))).toBe('16–20 พ.ย. 69'); // อาทิตย์
    expect(workWeekRange(new Date('2026-12-02T03:00:00Z'))).toBe('30 พ.ย. 69 – 4 ธ.ค. 69');
  });
  it('fmtDate ไม่มีค่า → —', () => expect(fmtDate(null)).toBe('—'));
  it('donut: ไม่มีโครงการไม่ระเบิด · ยอดรวมแสดงกลางวง', () => {
    expect(donutSvg([])).toContain('>0<');
    expect(donutSvg([{ status: 'DONE', count: 3 }])).toContain('>3<');
  });
});
