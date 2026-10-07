// สถานะสุขภาพโครงการของบอร์ด YOK
// ‼️ enum แยกจาก PROJECT_STATUS ของเราโดยตั้งใจ — NOT_START/BLOCKED ไม่มีคู่ในของเรา
//    และถ้าใช้ statusColor() ร่วมกันจะเปลี่ยนความหมายของหยกเงียบ ๆ
export const YOK_HEALTH = Object.freeze({
  NOT_START: 'NOT_START',
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  DELAYED: 'DELAYED',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
});

// เรียงสำคัญ: 'notstart' ต้องมาก่อน 'ontrack' ไม่งั้นโดนกลืน · 'block' ต้องไม่โดน 'risk' กิน
const PROBES = [
  ['notstart', YOK_HEALTH.NOT_START],
  ['complete', YOK_HEALTH.COMPLETED],
  ['done', YOK_HEALTH.COMPLETED],
  ['delay', YOK_HEALTH.DELAYED],
  ['late', YOK_HEALTH.DELAYED],
  ['block', YOK_HEALTH.BLOCKED],
  ['risk', YOK_HEALTH.AT_RISK],
  ['ontrack', YOK_HEALTH.ON_TRACK],
];

/**
 * ค่าหลวม ๆ จากชีต → enum หรือ null
 * ‼️ ว่าง/ไม่รู้จัก → null ไม่ใช่ NOT_START — เว็บหยก default แต่เราห้าม
 *    "0 โครงการเสี่ยง" กับ "คอลัมน์ health ว่าง" เป็นคนละข้อเท็จจริง (DESIGN-BRIEF §11)
 */
export function normalizeHealth(raw) {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return null;
  for (const [probe, val] of PROBES) if (s.includes(probe)) return val;
  return null;
}
