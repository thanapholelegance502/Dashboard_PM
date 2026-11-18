// โน้ตรายสัปดาห์ + ปิดสัปดาห์เก็บ PDF (บอร์ด KHAW) — ที่เดียวที่แตะ WeeklyNote / WeeklyReportArchive
// ‼️ closeWeek ไม่สร้าง PDF เอง (รับ report ที่ generate มาแล้ว) — กัน circular กับ report/sendWeekly.js
import { prisma } from '../db/prisma.js';
import { writeAudit } from '../domain/audit.js';
import { isoWeekBkk, workWeekRange } from '../report/thaiFormat.js';

const MAX_LEN = 5000; // กันโน้ตยาวเกินจนล้นหน้า PDF / payload

export function emptyNote() {
  return { summary: '', issues: '', outOfScope: '' };
}

/** คัดเฉพาะ 3 ช่องที่ใช้จริง (pure) */
export function pickNote(n) {
  if (!n) return emptyNote();
  return { summary: n.summary ?? '', issues: n.issues ?? '', outOfScope: n.outOfScope ?? '' };
}

/** ตัด/แปลงค่าที่รับจาก client ให้ปลอดภัย (pure — test ได้) */
export function normalizeNote(data = {}) {
  const f = (v) => String(v ?? '').replace(/\r\n/g, '\n').slice(0, MAX_LEN);
  return { summary: f(data.summary), issues: f(data.issues), outOfScope: f(data.outOfScope) };
}

/** สัปดาห์นี้ปิดแล้วหรือยัง (มีใน archive = ปิดแล้ว) */
export async function isWeekClosed(weekKey) {
  const hit = await prisma.weeklyReportArchive.findUnique({ where: { weekKey }, select: { weekKey: true } });
  return Boolean(hit);
}

/** โน้ตดิบของสัปดาห์ (ให้ generateWeeklyReport เอาไปลง PDF) — ไม่มี = 3 ช่องว่าง */
export async function getStoredNoteData(weekKey) {
  const n = await prisma.weeklyNote.findUnique({ where: { weekKey } });
  return pickNote(n);
}

/** สถานะโน้ตสัปดาห์ปัจจุบัน (หน้า KHAW) */
export async function getCurrentWeekNote(now = new Date()) {
  const weekKey = isoWeekBkk(now);
  const [note, closed] = await Promise.all([
    prisma.weeklyNote.findUnique({ where: { weekKey } }),
    isWeekClosed(weekKey),
  ]);
  return { weekKey, weekRange: workWeekRange(now), note: pickNote(note), updatedAt: note?.updatedAt ?? null, closed };
}

/** บันทึกโน้ต — เฉพาะสัปดาห์ที่ยังไม่ปิด · ลง AuditLog */
export async function saveWeekNote({ weekKey, data, actor = null }) {
  if (await isWeekClosed(weekKey)) {
    const e = new Error('สัปดาห์นี้ปิดรายงานแล้ว แก้โน้ตไม่ได้');
    e.status = 409;
    throw e;
  }
  const clean = normalizeNote(data);
  const before = await prisma.weeklyNote.findUnique({ where: { weekKey } });
  const saved = await prisma.weeklyNote.upsert({
    where: { weekKey },
    create: { weekKey, ...clean, updatedBy: actor?.id ?? null },
    update: { ...clean, updatedBy: actor?.id ?? null },
  });
  await writeAudit({
    appUserId: actor?.id ?? null,
    entity: 'WeeklyNote',
    entityId: weekKey,
    action: before ? 'UPDATE' : 'CREATE',
    before: before ? pickNote(before) : undefined,
    after: clean,
  });
  return { weekKey, note: pickNote(saved), updatedAt: saved.updatedAt, closed: false };
}

/**
 * ปิดสัปดาห์ = เก็บ PDF ลง archive (ดึงย้อนหลังได้ตรงตัว) + ล็อกโน้ต
 * @param report ผลจาก generateWeeklyReport (มีแล้ว ใช้ซ้ำ ไม่เปิด Chromium เพิ่ม)
 * กดซ้ำ = เขียนทับฉบับสัปดาห์นี้ · ทุกครั้งลง AuditLog
 */
export async function closeWeek({ now = new Date(), report, actor = null }) {
  if (!report?.pdf) throw new Error('closeWeek ต้องมี report.pdf ที่สร้างไว้แล้ว');
  const weekKey = isoWeekBkk(now);
  const dataAsOf = report.model?.dataAt ?? null;
  const existed = await isWeekClosed(weekKey);
  await prisma.weeklyReportArchive.upsert({
    where: { weekKey },
    create: { weekKey, pdf: report.pdf, dataAsOf, generatedAt: new Date() },
    update: { pdf: report.pdf, dataAsOf, generatedAt: new Date() },
  });
  await writeAudit({
    appUserId: actor?.id ?? null,
    entity: 'WeeklyReportArchive',
    entityId: weekKey,
    action: existed ? 'UPDATE' : 'CREATE',
    after: { pdfBytes: report.pdf.length, dataAsOf, redo: existed },
  });
  return { weekKey, pdfBytes: report.pdf.length, redo: existed };
}

/** รายการสัปดาห์ที่ปิดแล้ว (ใหม่สุดก่อน) — ไม่ดึง bytes ของ PDF */
export async function listArchives(limit = 52) {
  return prisma.weeklyReportArchive.findMany({
    orderBy: { weekKey: 'desc' },
    take: limit,
    select: { weekKey: true, dataAsOf: true, generatedAt: true },
  });
}

/** PDF ของสัปดาห์ที่ปิดแล้ว (null = ยังไม่ปิด/ไม่มี) */
export async function getArchivePdf(weekKey) {
  const row = await prisma.weeklyReportArchive.findUnique({ where: { weekKey } });
  return row ? { pdf: Buffer.from(row.pdf), generatedAt: row.generatedAt } : null;
}
