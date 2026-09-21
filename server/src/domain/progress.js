// Progress % แบบถ่วงน้ำหนักตาม section + สูตร KPI มาตรฐาน (MASTER §4.3, §9, §10)
import { BUCKET, OPEN_BUCKETS } from './enums.js';
import { isOverdue, daysUntil } from './time.js';

export const OVERRIDE_TTL_DAYS = 14; // override หมดอายุ 14 วัน (02-PM §4, §5)

/** override ยังไม่หมดอายุไหม (14 วันนับจาก overrideAt) */
export function isOverrideActive(overrideAt, now = new Date()) {
  if (!overrideAt) return false;
  const age = -(daysUntil(overrideAt, now) ?? -9999); // วันที่ผ่านมาแล้ว
  return age <= OVERRIDE_TTL_DAYS;
}

/**
 * progress ที่ใช้แสดงจริง — override สด → ใช้ override, ไม่งั้นค่าคำนวณ (02-PM §4)
 * @returns {{ value:number|null, source:'AUTO'|'OVERRIDE', computed:number|null, overrideExpired:boolean }}
 */
export function resolveEffectiveProgress(project, computed, now = new Date()) {
  const has = project.progressOverride != null;
  if (has && isOverrideActive(project.progressOverrideAt, now)) {
    return { value: project.progressOverride, source: 'OVERRIDE', computed, overrideExpired: false };
  }
  return { value: computed, source: 'AUTO', computed, overrideExpired: has };
}

/**
 * Progress % = ถ่วงน้ำหนักตาม section (MASTER §9, §10)
 *   = Σ(sectionWeight ของทุกการ์ด) / (จำนวนการ์ด × 100) × 100
 *   = ค่าเฉลี่ยของ weight (เพราะ weight สูงสุด = 100)
 * นับทุกการ์ดที่ยังไม่ถูกลบ (รวม BLOCKED ด้วย weight ของมัน)
 * @param {Array<{sectionWeight:number, isDeleted?:boolean}>} tasks
 * @returns {number|null} 0-100 หรือ null ถ้าไม่มีการ์ด (ห้ามคืน 0 — MASTER §11)
 */
export function computeWeightedProgress(tasks) {
  const live = tasks.filter((t) => !t.isDeleted);
  if (live.length === 0) return null;
  const sumWeight = live.reduce((acc, t) => acc + (t.sectionWeight ?? 0), 0);
  return Math.round(sumWeight / live.length);
}

/**
 * สูตร KPI มาตรฐาน — ทุกแผนกใช้เหมือนกัน (MASTER §4.3)
 * @param {Array<{bucketCode:string, dueAt?:Date|string|null, isDeleted?:boolean}>} tasks
 * @param {Date} [now] เวลาอ้างอิง (default = ตอนนี้) ตัดสิน overdue ด้วย Asia/Bangkok
 */
export function computeKpi(tasks, now = new Date()) {
  const live = tasks.filter((t) => !t.isDeleted);

  const open = live.filter((t) => OPEN_BUCKETS.includes(t.bucketCode)).length;
  const done = live.filter((t) => t.bucketCode === BUCKET.DONE).length;
  const blocker = live.filter((t) => t.bucketCode === BUCKET.BLOCKED).length;
  const overdue = live.filter(
    (t) => t.bucketCode !== BUCKET.DONE && isOverdue(t.dueAt, now)
  ).length;

  const denom = open + done; // BLOCKED ไม่อยู่ใน denominator (MASTER §4.3)
  const pctDone = denom > 0 ? Math.round((done / denom) * 100) : null;

  return {
    open, // ค้าง
    done, // เสร็จ
    active: open, // Active = ค้าง (ล็อกแล้ว ไม่รวม done)
    blocker,
    overdue,
    pctDone, // null = ไม่มีการ์ดเลย (ห้ามแสดง 0)
    total: live.length,
  };
}
