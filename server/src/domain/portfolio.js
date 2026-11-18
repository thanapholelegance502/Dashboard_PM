// สรุประดับ portfolio ของบอร์ด PM (KHAW) — pure ไม่แตะ Prisma → test ได้ใน test:ci
// ‼️ MASTER §12.2: หน้า /pm กับรายงาน PDF/อีเมลรายสัปดาห์เรียกชุดนี้ชุดเดียวกัน
//    ตัวเลขในรายงานจึงไม่มีทางต่างจากบนจอ
import { PROJECT_STATUS } from './enums.js';
import { daysUntil, todayDateStrBkk } from './time.js';

/** วันที่อยู่เดือนเดียวกับ now ตามปฏิทินกรุงเทพ */
export function sameBkkMonth(date, now) {
  if (!date) return false;
  return todayDateStrBkk(date).slice(0, 7) === todayDateStrBkk(now).slice(0, 7);
}

/** แถวโครงการที่ส่งให้หน้า /pm (ลำดับ field เดิม — response ต้องเหมือนเดิมทุก byte) */
export function toProjectRow(p, m) {
  return {
    code: p.projectCode,
    displayName: p.displayName,
    pmUserId: p.pmUserId,
    progressPct: m.progressPct,
    progressSource: m.progressSource,
    progressComputed: m.progressComputed,
    status: m.status,
    statusSource: m.statusSource,
    statusAuto: m.statusAuto,
    statusReasons: m.statusReasons,
    startDate: p.startDate,
    targetUat: p.targetUat,
    actualUat: p.actualUat,
    targetGolive: p.targetGolive,
    actualGolive: p.actualGolive,
    slipDays: m.slipDays,
    hasTargetGolive: p.targetGolive != null,
    counts: m.counts,
  };
}

/** KPI 7 ใบ — นับจาก effective status ของทุกโครงการ (ไม่กรอง) */
export function computePortfolioKpis(all, now) {
  return {
    total: all.length,
    onTrack: all.filter((r) => r.metrics.status === PROJECT_STATUS.ON_TRACK).length,
    atRisk: all.filter((r) => r.metrics.status === PROJECT_STATUS.AT_RISK).length,
    delayed: all.filter((r) => r.metrics.status === PROJECT_STATUS.DELAYED).length,
    waiting: all.filter((r) => r.metrics.status === PROJECT_STATUS.WAITING).length,
    uatThisMonth: all.filter((r) => sameBkkMonth(r.project.targetUat, now)).length,
    goliveThisMonth: all.filter((r) => sameBkkMonth(r.project.targetGolive, now)).length,
  };
}

/** milestone ที่ยังไม่เกิด (มี target แต่ยังไม่มี actual) · days=null = ไม่จำกัดช่วง */
export function computeUpcomingMilestones(projects, now, { days = null, limit = 12 } = {}) {
  const items = [];
  for (const p of projects) {
    const uat = p.actualUat ? null : p.targetUat;
    const golive = p.actualGolive ? null : p.targetGolive;
    for (const [type, date] of [['UAT', uat], ['GO_LIVE', golive]]) {
      const d = daysUntil(date, now);
      if (date && d != null && d >= 0 && (days == null || d <= days)) {
        items.push({ code: p.projectCode, displayName: p.displayName, type, date, inDays: d });
      }
    }
  }
  items.sort((a, b) => a.inDays - b.inDays);
  return items.slice(0, limit);
}

/** ลำดับเดียวกับ donut บนหน้า PM (web/src/pages/PM.tsx donutData) */
export const STATUS_ORDER = Object.freeze(['WAITING', 'ON_TRACK', 'AT_RISK', 'DELAYED', 'DONE']);

/** นับโครงการตามสถานะ — ไม่ใส่สถานะที่เป็น 0 (เหมือน donut) */
export function computeStatusBreakdown(projectRows) {
  const by = {};
  for (const p of projectRows) by[p.status] = (by[p.status] ?? 0) + 1;
  return STATUS_ORDER.filter((s) => by[s]).map((s) => ({ status: s, count: by[s] }));
}
