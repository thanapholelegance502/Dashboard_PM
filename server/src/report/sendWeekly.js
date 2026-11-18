// สร้าง + ส่งรายงานรายสัปดาห์ — ทุกทาง (cron / ปุ่มทดสอบ / CLI) มาจบที่นี่
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { getPmBoardSummary } from '../services/pmBoard.js';
import { buildReportModel, renderReportHtml, renderEmailHtml, renderEmailText, buildSubject, reportFilename } from './weeklyReport.js';
import { embeddedFontCss } from './fonts.js';
import { renderPdf } from './pdf.js';
import { isoDateBkk } from './thaiFormat.js';
import { resolveRecipients } from '../mail/recipients.js';
import { sendMail } from '../mail/mailer.js';
import { writeAudit } from '../domain/audit.js';

/** ISO week ตามวันกรุงเทพ เช่น 2026-W47 — กุญแจกันส่งซ้ำในสัปดาห์เดียว */
export function isoWeekBkk(now) {
  const d = new Date(`${isoDateBkk(now)}T00:00:00Z`);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((d - yearStart) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

/** สร้างรายงาน (ไม่ส่ง) → { model, pdf, filename } */
export async function generateWeeklyReport({ now = new Date(), expectSince = null } = {}) {
  const summary = await getPmBoardSummary({ now });
  const model = buildReportModel(summary, { baseUrl: env.publicBaseUrl, now, expectSince });
  const pdf = await renderPdf(renderReportHtml(model, { fontCss: embeddedFontCss() }), { footerUrl: model.links.board });
  return { model, pdf, filename: reportFilename(model) };
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
export async function sendWeeklyReport({ kind, actor = null, override = null, now = new Date(), force = false, expectSince = null }) {
  // ด่านผู้รับมาก่อนทุกอย่าง — ไม่ผ่านก็ไม่ต้องเปิด Chromium
  const to = resolveRecipients({ kind, env, user: actor, override });
  const weekKey = kind === 'SCHEDULED' ? isoWeekBkk(now) : kind === 'TEST' ? 'TEST' : 'CLI';

  if (kind === 'SCHEDULED' && !force && (await alreadySentThisWeek(weekKey))) {
    console.log(`[weekly-report] ${weekKey} ส่งไปแล้ว ข้าม`);
    return { skipped: true, weekKey };
  }

  const domains = [...new Set(to.map((e) => e.split('@')[1]))];
  try {
    const { model, pdf, filename } = await generateWeeklyReport({ now, expectSince });
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
