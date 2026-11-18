// สร้าง + ส่งรายงานรายสัปดาห์ — ทุกทาง (cron / ปุ่มทดสอบ / CLI) มาจบที่นี่
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { getPmBoardSummary } from '../services/pmBoard.js';
import { buildReportModel, renderReportHtml, renderEmailHtml, renderEmailText, buildSubject, reportFilename } from './weeklyReport.js';
import { embeddedFontCss } from './fonts.js';
import { renderPdf } from './pdf.js';
import { isoWeekBkk } from './thaiFormat.js';
import { resolveRecipients } from '../mail/recipients.js';
import { sendMail } from '../mail/mailer.js';
import { writeAudit } from '../domain/audit.js';
import { getStoredNoteData, closeWeek } from '../services/weeklyNotes.js';
import { isWeeklyReportEnabled } from '../config/env.js';

export { isoWeekBkk }; // คงจุด import เดิม (test/recipients.test.js)

/** สร้างรายงาน (ไม่ส่ง) → { model, pdf, filename } · รวมโน้ต 3 ช่องของสัปดาห์นั้น */
export async function generateWeeklyReport({ now = new Date(), expectSince = null } = {}) {
  const [summary, note] = await Promise.all([
    getPmBoardSummary({ now }),
    getStoredNoteData(isoWeekBkk(now)),
  ]);
  // footer ไม่โชว์ลิงก์ถ้า PUBLIC_BASE_URL ว่าง (กันลิงก์เสีย "/pm")
  const model = buildReportModel(summary, { baseUrl: env.publicBaseUrl, now, expectSince, note });
  const pdf = await renderPdf(renderReportHtml(model, { fontCss: embeddedFontCss() }), {
    footerUrl: env.publicBaseUrl ? model.links.board : '',
  });
  return { model, pdf, filename: reportFilename(model) };
}

/**
 * งานศุกร์ 17:30 — ปิดสัปดาห์เก็บ PDF "เสมอ" แล้วส่งเมล "ถ้าเปิดไว้" (ใช้ PDF ไฟล์เดียวกัน)
 * ‼️ ประวัติ (archive) ไม่ผูกกับเมล — SMTP ยังไม่ตั้งก็ยังเก็บ PDF ย้อนหลังได้
 */
export async function runScheduledWeekly({ now = new Date(), expectSince = null } = {}) {
  const report = await generateWeeklyReport({ now, expectSince });
  const archived = await closeWeek({ now, report }); // เสมอ (ไม่ขึ้นกับ SMTP)
  let sent = null;
  if (isWeeklyReportEnabled()) {
    sent = await sendWeeklyReport({ kind: 'SCHEDULED', expectSince, report });
  } else {
    console.log(`[weekly-report] ${archived.weekKey} เก็บ archive แล้ว · ยังไม่ตั้ง SMTP → ไม่ส่งเมล`);
  }
  return { archived, sent };
}

async function alreadySentThisWeek(weekKey) {
  const hit = await prisma.auditLog.findFirst({ where: { entity: 'WeeklyReport', entityId: weekKey, action: 'SEND' } });
  return Boolean(hit);
}

/**
 * @param kind 'SCHEDULED' | 'TEST' | 'CLI_TO'
 * @param actor AppUser (ปุ่มทดสอบ) หรือ null (cron/CLI)
 * @param expectSince เวลาที่ sync ควรสำเร็จหลังจากนั้น (cron ศุกร์)
 */
export async function sendWeeklyReport({ kind, actor = null, override = null, now = new Date(), force = false, expectSince = null, report = null }) {
  // ด่านผู้รับมาก่อนทุกอย่าง — ไม่ผ่านก็ไม่ต้องเปิด Chromium
  const to = resolveRecipients({ kind, env, user: actor, override });
  const weekKey = kind === 'SCHEDULED' ? isoWeekBkk(now) : kind === 'TEST' ? 'TEST' : 'CLI';

  if (kind === 'SCHEDULED' && !force && (await alreadySentThisWeek(weekKey))) {
    console.log(`[weekly-report] ${weekKey} ส่งไปแล้ว ข้าม`);
    return { skipped: true, weekKey };
  }

  const domains = [...new Set(to.map((e) => e.split('@')[1]))];
  try {
    // ใช้ PDF ที่ปิดสัปดาห์สร้างไว้แล้ว (ศุกร์ 17:30) ถ้ามี — ไม่เปิด Chromium ซ้ำ
    const { model, pdf, filename } = report ?? (await generateWeeklyReport({ now, expectSince }));
    const info = await sendMail({
      to,
      subject: buildSubject(model, { test: kind !== 'SCHEDULED' }),
      html: renderEmailHtml(model),
      text: renderEmailText(model),
      attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
    });
    // ‼️ ไม่เก็บอีเมลผู้รับใน log (เก็บแค่จำนวน + โดเมน)
    await writeAudit({
      appUserId: actor?.id ?? null,
      entity: 'WeeklyReport',
      entityId: weekKey,
      action: 'SEND',
      after: { kind, recipientCount: to.length, recipientDomains: domains, messageId: info.messageId, pdfBytes: pdf.length, dataAsOf: model.dataAt, freshness: model.freshness.level },
    });
    console.log(`[weekly-report] ส่งแล้ว (${kind}) → ${to.length} ผู้รับ`);
    return { sent: true, weekKey, recipientCount: to.length, freshness: model.freshness.level };
  } catch (err) {
    await writeAudit({
      appUserId: actor?.id ?? null,
      entity: 'WeeklyReport',
      entityId: weekKey,
      action: 'SEND_FAILED',
      after: { kind, recipientCount: to.length, recipientDomains: domains, error: String(err.message).slice(0, 300) },
    }).catch(() => {});
    throw err;
  }
}

/** ประวัติการส่งล่าสุด (หน้าตั้งค่า) */
export async function recentSends(limit = 5) {
  return prisma.auditLog.findMany({
    where: { entity: 'WeeklyReport' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, entityId: true, action: true, after: true, createdAt: true },
  });
}
