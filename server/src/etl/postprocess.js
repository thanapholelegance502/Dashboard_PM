// runSync step 6-7 (DATA-LAYER §5): recompute metrics + auto attention
import { prisma } from '../db/prisma.js';
import { computeProjectMetrics } from '../domain/metrics.js';
import { computeAutoAttention } from '../domain/attention.js';
import { isOverrideActive } from '../domain/progress.js';
import { writeAudit } from '../domain/audit.js';

/** step 6: เคลียร์ override ที่หมดอายุ 14 วัน (02-PM §4/§5) + ลง AuditLog */
async function clearExpiredOverrides(project, now) {
  const patch = {};
  const before = {};
  if (project.statusOverride != null && !isOverrideActive(project.statusOverrideAt, now)) {
    before.statusOverride = project.statusOverride;
    Object.assign(patch, {
      statusOverride: null,
      statusOverrideReason: null,
      statusOverrideBy: null,
      statusOverrideAt: null,
    });
  }
  if (project.progressOverride != null && !isOverrideActive(project.progressOverrideAt, now)) {
    before.progressOverride = project.progressOverride;
    Object.assign(patch, {
      progressOverride: null,
      progressOverrideReason: null,
      progressOverrideBy: null,
      progressOverrideAt: null,
    });
  }
  if (Object.keys(patch).length === 0) return project;

  const updated = await prisma.project.update({ where: { id: project.id }, data: patch });
  await writeAudit({
    entity: 'Project',
    entityId: project.id,
    action: 'UPDATE',
    before,
    after: {},
    reason: 'override หมดอายุ 14 วัน (auto)',
  });
  return updated;
}

/** step 7: gen/resolve AttentionItem source=AUTO ตามเงื่อนไข §7 */
async function refreshAutoAttention(project, metrics, tasks, now) {
  const existingAutoOpen = await prisma.attentionItem.findMany({
    where: { projectId: project.id, source: 'AUTO', status: 'OPEN' },
  });
  const { toCreate, toResolveIds } = computeAutoAttention(project, metrics, tasks, existingAutoOpen, now);

  for (const item of toCreate) {
    await prisma.attentionItem.create({ data: item });
  }
  if (toResolveIds.length) {
    await prisma.attentionItem.updateMany({
      where: { id: { in: toResolveIds } },
      data: { status: 'RESOLVED', resolvedAt: now },
    });
  }
  return { created: toCreate.length, resolved: toResolveIds.length };
}

/** เรียกท้าย runSync — วนทุก active project */
export async function recomputeMetricsAndAttention(now = new Date()) {
  const projects = await prisma.project.findMany({ where: { isActive: true } });
  let created = 0;
  let resolved = 0;
  for (const p0 of projects) {
    const project = await clearExpiredOverrides(p0, now);
    const tasks = await prisma.task.findMany({ where: { projectId: project.id, isDeleted: false } });
    const metrics = computeProjectMetrics(project, tasks, now);
    const r = await refreshAutoAttention(project, metrics, tasks, now);
    created += r.created;
    resolved += r.resolved;
  }
  return { created, resolved };
}
