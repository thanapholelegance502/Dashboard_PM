// รวม metric ของ 1 project ไว้ที่เดียว — ทั้ง API และ attention ใช้ก้อนนี้ร่วมกัน
// (MASTER §12.2 KPI กับ list ที่อธิบายมัน ต้องมาจากที่เดียวกัน)
import { computeKpi, computeWeightedProgress, resolveEffectiveProgress, isOverrideActive } from './progress.js';
import { computeAutoStatus } from './status.js';
import { daysUntil } from './time.js';

/** status ที่ใช้แสดงจริง — override สด → ใช้ override, ไม่งั้น auto (02-PM §5) */
export function resolveEffectiveStatus(project, auto, now = new Date()) {
  const has = project.statusOverride != null;
  if (has && isOverrideActive(project.statusOverrideAt, now)) {
    return {
      value: project.statusOverride,
      source: 'OVERRIDE',
      auto: auto.status,
      autoReasons: auto.reasons,
      overrideExpired: false,
    };
  }
  return { value: auto.status, source: 'AUTO', auto: auto.status, autoReasons: auto.reasons, overrideExpired: has };
}

/**
 * @param {object} project Project row
 * @param {object[]} tasks Task[] ของ project นี้ (ไม่รวม isDeleted ก็ได้ — filter ซ้ำ)
 * @param {Date} now
 */
export function computeProjectMetrics(project, tasks, now = new Date()) {
  const kpi = computeKpi(tasks, now);
  const computedProgress = computeWeightedProgress(tasks);

  const autoStatus = computeAutoStatus(
    project,
    {
      openCount: kpi.open,
      doneCount: kpi.done,
      blockedCount: kpi.blocker,
      overdueCount: kpi.overdue,
      progressPct: computedProgress ?? 0,
    },
    now
  );

  const progress = resolveEffectiveProgress(project, computedProgress, now);
  const status = resolveEffectiveStatus(project, autoStatus, now);

  const slipDays =
    project.forecastGolive && project.targetGolive
      ? daysUntil(project.forecastGolive, project.targetGolive)
      : null;

  return {
    counts: { open: kpi.open, done: kpi.done, blocked: kpi.blocker, overdue: kpi.overdue, total: kpi.total },
    active: kpi.active,
    pctDone: kpi.pctDone,
    progressPct: progress.value,
    progressSource: progress.source,
    progressComputed: progress.computed,
    progressOverrideExpired: progress.overrideExpired,
    status: status.value,
    statusSource: status.source,
    statusAuto: status.auto,
    statusReasons: status.autoReasons,
    statusOverrideExpired: status.overrideExpired,
    slipDays,
  };
}
