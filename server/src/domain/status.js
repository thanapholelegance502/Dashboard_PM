// สถานะโปรเจกต์ auto — 02-PM-DASHBOARD §5.1 (ล็อกแล้ว)
// ประเมินตามลำดับ DONE → DELAYED → AT_RISK → ON_TRACK
// เก็บ "เหตุผลที่ระบบให้สถานะนี้" เสมอ (ห้ามแสดงสีเฉยๆ — CEO จะถามทำไม)
import { PROJECT_STATUS } from './enums.js';
import { daysUntil } from './time.js';

/**
 * @param {object} p Project (actualGolive, forecastGolive, targetGolive, ...)
 * @param {object} m metrics { openCount, doneCount, blockedCount, overdueCount, progressPct }
 * @param {Date} now
 * @returns {{ status:string, reasons:string[] }}
 */
export function computeAutoStatus(p, m, now = new Date()) {
  if (p.actualGolive) {
    return { status: PROJECT_STATUS.DONE, reasons: ['go-live แล้ว'] };
  }

  // DELAYED
  const delayReasons = [];
  if (p.forecastGolive && p.targetGolive && p.forecastGolive.getTime() > p.targetGolive.getTime()) {
    const slip = daysUntil(p.forecastGolive, p.targetGolive) ?? 0;
    delayReasons.push(`forecast ช้ากว่า target ${slip} วัน`);
  }
  if (p.targetGolive && now.getTime() > p.targetGolive.getTime()) {
    delayReasons.push('เลยกำหนด target Go-Live แล้ว');
  }
  if (delayReasons.length) {
    return { status: PROJECT_STATUS.DELAYED, reasons: delayReasons };
  }

  // AT_RISK
  const riskReasons = [];
  if (m.blockedCount > 0) {
    riskReasons.push(`มีงานติดปัญหา ${m.blockedCount} ใบ`);
  }
  if (m.openCount > 0 && m.overdueCount / m.openCount > 0.1) {
    const pct = Math.round((m.overdueCount / m.openCount) * 100);
    riskReasons.push(`งานเกินกำหนด ${pct}% (${m.overdueCount}/${m.openCount})`);
  }
  const d = daysUntil(p.targetGolive, now);
  if (p.targetGolive && d != null && d <= 14 && (m.progressPct ?? 0) < 80) {
    riskReasons.push(`เหลือ ${d} วันถึง target แต่ progress ${m.progressPct ?? 0}%`);
  }
  if (riskReasons.length) {
    return { status: PROJECT_STATUS.AT_RISK, reasons: riskReasons };
  }

  return { status: PROJECT_STATUS.ON_TRACK, reasons: ['ไม่มีสัญญาณเสี่ยง'] };
}
