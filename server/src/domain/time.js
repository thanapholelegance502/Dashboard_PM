// Timezone helpers — DATA-LAYER §6
// DB เก็บ UTC · ทุกการตัดสินใจเชิงธุรกิจใช้ Asia/Bangkok · ใช้ date-fns-tz ตัวเดียว
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export const BKK = 'Asia/Bangkok';

/** เที่ยงคืนของ "วันนี้" (Asia/Bangkok) คืนเป็น Date (UTC instant) */
export function startOfTodayBkk(now = new Date()) {
  const zoned = toZonedTime(now, BKK);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, BKK);
}

/** overdue = dueAt < เที่ยงคืนวันนี้ (Asia/Bangkok) — ตัวเรียกต้องเช็ค bucket != DONE เอง */
export function isOverdue(dueAt, now = new Date()) {
  if (!dueAt) return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < startOfTodayBkk(now).getTime();
}

/** วันที่ (YYYY-MM-DD) ตาม Asia/Bangkok — ใช้เป็น snapshotDate */
export function todayDateStrBkk(now = new Date()) {
  const zoned = toZonedTime(now, BKK);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, '0');
  const d = String(zoned.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Date object ที่ตรงกับเที่ยงคืน Bangkok ของวันนี้ สำหรับ field @db.Date */
export function snapshotDateBkk(now = new Date()) {
  return new Date(`${todayDateStrBkk(now)}T00:00:00.000Z`);
}

/** จำนวนวันจาก now ถึง target (บวก = อนาคต, ลบ = อดีต) — วัดขอบวัน Asia/Bangkok */
export function daysUntil(target, now = new Date()) {
  if (!target) return null;
  const t = target instanceof Date ? target : new Date(target);
  if (Number.isNaN(t.getTime())) return null;
  const day = 24 * 60 * 60 * 1000;
  return Math.round((startOfDayBkk(t).getTime() - startOfTodayBkk(now).getTime()) / day);
}

/** เที่ยงคืน Bangkok ของวันที่ที่ให้มา */
function startOfDayBkk(d) {
  const zoned = toZonedTime(d, BKK);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, BKK);
}
