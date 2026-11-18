// ดึงข้อมูลบอร์ด PM (KHAW) — ที่เดียวที่ query Prisma ให้หน้า /pm และรายงานรายสัปดาห์
// route /api/pm/* กับตัวสร้าง PDF เรียกชุดนี้ชุดเดียวกัน (MASTER §12.2)
import { prisma } from '../db/prisma.js';
import { computeProjectMetrics } from '../domain/metrics.js';
import {
  toProjectRow,
  computePortfolioKpis,
  computeUpcomingMilestones,
  computeStatusBreakdown,
  sortByPain,
} from '../domain/portfolio.js';

export async function getLastSyncAt() {
  const s = await prisma.syncRun.findFirst({
    where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
    orderBy: { startedAt: 'desc' },
  });
  return s?.finishedAt ?? null;
}

/** sync ล่าสุด (สำเร็จ/ไม่สำเร็จ) — รายงานใช้ตัดสินว่าข้อมูลสดพอไหม */
export async function getLastSyncRuns() {
  const [last, lastSuccess] = await Promise.all([
    prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    prisma.syncRun.findFirst({ where: { status: { in: ['SUCCESS', 'PARTIAL'] } }, orderBy: { startedAt: 'desc' } }),
  ]);
  return { last, lastSuccess };
}

/** โหลด project + tasks + metrics ต่อ project */
export async function loadProjectMetrics(now, where = {}) {
  const projects = await prisma.project.findMany({
    where: { isActive: true, ...where },
    orderBy: { sortOrder: 'asc' },
  });
  const out = [];
  for (const p of projects) {
    const tasks = await prisma.task.findMany({ where: { projectId: p.id, isDeleted: false } });
    out.push({ project: p, metrics: computeProjectMetrics(p, tasks, now) });
  }
  return out;
}

/** portfolio โหมดปัจจุบัน — KPI นับทุกโครงการเสมอ · list กรองตาม filter */
export async function getPortfolio({ now = new Date(), filters = {} } = {}) {
  const { pm, status, projectCode } = filters;
  const where = {};
  if (projectCode) where.projectCode = String(projectCode);
  if (pm) where.pmUserId = Number(pm); // B7: ยังไม่มี pmUserId → คืนว่าง

  let rows = await loadProjectMetrics(now, where);
  if (status) rows = rows.filter((r) => r.metrics.status === String(status));
  // เรียงตามความเดือดร้อน (Delayed → At Risk → On Track → Waiting → Done) · Done ยังอยู่ในชุด
  // เพื่อให้ KPI/donut นับครบ · หน้า/PDF เป็นคนแยก Done ไปโชว์ section "เสร็จแล้ว" เอง
  const projects = sortByPain(rows.map(({ project, metrics }) => toProjectRow(project, metrics)));

  const all = await loadProjectMetrics(now); // ทุกโปรเจกต์สำหรับ KPI (ไม่กรอง)
  const kpis = computePortfolioKpis(all, now);

  return { asOf: now.toISOString(), lastSyncAt: await getLastSyncAt(), kpis, projects };
}

export async function getMilestones({ now = new Date(), days = null, limit = 12 } = {}) {
  const projects = await prisma.project.findMany({ where: { isActive: true } });
  return { asOf: now.toISOString(), days, items: computeUpcomingMilestones(projects, now, { days, limit }) };
}

export async function getAttention({ status = 'OPEN' } = {}) {
  const items = await prisma.attentionItem.findMany({
    where: { status },
    orderBy: [{ neededBy: 'asc' }, { createdAt: 'desc' }],
    include: { project: { select: { projectCode: true, displayName: true } } },
  });
  return { asOf: new Date().toISOString(), items };
}

/** ทุกอย่างที่หน้า /pm แสดงเมื่อไม่มี filter — input เดียวของรายงานรายสัปดาห์ */
export async function getPmBoardSummary({ now = new Date() } = {}) {
  const [portfolio, milestones, attention, sync] = await Promise.all([
    getPortfolio({ now }),
    getMilestones({ now }),
    getAttention({ status: 'OPEN' }),
    getLastSyncRuns(),
  ]);
  return {
    generatedAt: now.toISOString(),
    portfolio,
    milestones,
    attention,
    statusBreakdown: computeStatusBreakdown(portfolio.projects),
    sync,
  };
}
