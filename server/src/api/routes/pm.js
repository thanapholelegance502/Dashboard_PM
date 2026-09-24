// PM Dashboard API — 02-PM-DASHBOARD §11
import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { computeProjectMetrics } from '../../domain/metrics.js';
import { computeAutoStatus } from '../../domain/status.js';
import { PROJECT_STATUS, BUCKET } from '../../domain/enums.js';
import { isOverdue, daysUntil, todayDateStrBkk } from '../../domain/time.js';

export const pmRouter = Router();

async function getLastSyncAt() {
  const s = await prisma.syncRun.findFirst({
    where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
    orderBy: { startedAt: 'desc' },
  });
  return s?.finishedAt ?? null;
}

/** โหลด project + tasks + metrics ต่อ project (ใช้ร่วมหลาย endpoint) */
async function loadProjectMetrics(now, where = {}) {
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

function sameBkkMonth(date, now) {
  if (!date) return false;
  return todayDateStrBkk(date).slice(0, 7) === todayDateStrBkk(now).slice(0, 7);
}

/**
 * as-of mode — ดูข้อมูลย้อนหลัง ณ วันที่ อ่านจาก DailyAggregate (snapshot ล่าสุด ≤ asOf)
 * counts/progress มาจาก snapshot วันนั้น · overdue ไม่มีใน snapshot → null (ไม่แสดง 0 หลอก §11)
 */
async function loadAsOfMetrics(asOfDate, now) {
  // หา snapshotDate ล่าสุดที่ ≤ asOf
  const latest = await prisma.dailyAggregate.findFirst({
    where: { snapshotDate: { lte: asOfDate } },
    orderBy: { snapshotDate: 'desc' },
    select: { snapshotDate: true },
  });
  if (!latest) return { snapshotUsed: null, rows: [] };

  const aggs = await prisma.dailyAggregate.findMany({ where: { snapshotDate: latest.snapshotDate } });
  const projects = await prisma.project.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });

  const byProject = new Map();
  for (const a of aggs) {
    if (!byProject.has(a.projectId)) byProject.set(a.projectId, { open: 0, done: 0, blocked: 0, total: 0, progressPct: null });
    const m = byProject.get(a.projectId);
    if (['BACKLOG', 'IN_PROGRESS', 'WAITING'].includes(a.bucketCode)) m.open += a.taskCount;
    else if (a.bucketCode === 'DONE') m.done += a.taskCount;
    else if (a.bucketCode === 'BLOCKED') m.blocked += a.taskCount;
    m.total += a.taskCount;
    if (a.progressPct != null) m.progressPct = a.progressPct;
  }

  const rows = projects.map((p) => {
    const m = byProject.get(p.id) ?? { open: 0, done: 0, blocked: 0, total: 0, progressPct: null };
    // status auto จาก counts as-of (overdue ไม่รู้ = 0)
    const auto = computeAutoStatus(
      p,
      { openCount: m.open, doneCount: m.done, blockedCount: m.blocked, overdueCount: 0, progressPct: m.progressPct ?? 0 },
      now
    );
    return { project: p, metrics: { counts: { ...m, overdue: null }, progressPct: m.progressPct, status: auto.status, statusReasons: auto.reasons, hasData: byProject.has(p.id) } };
  });
  return { snapshotUsed: latest.snapshotDate, rows };
}

// GET /api/pm/portfolio?pm=&status=&projectCode=&asOf=YYYY-MM-DD
pmRouter.get('/portfolio', async (req, res, next) => {
  try {
    const now = new Date();
    const { pm, status, projectCode, asOf } = req.query;

    // ── as-of mode (ย้อนหลัง) ──
    if (asOf) {
      const asOfDate = new Date(`${asOf}T23:59:59.999Z`);
      const { snapshotUsed, rows } = await loadAsOfMetrics(asOfDate, now);
      let list = rows;
      if (projectCode) list = list.filter((r) => r.project.projectCode === projectCode);
      if (status) list = list.filter((r) => r.metrics.status === String(status));
      const projects = list.map(({ project: p, metrics: m }) => ({
        code: p.projectCode,
        displayName: p.displayName,
        pmUserId: p.pmUserId,
        progressPct: m.progressPct,
        progressSource: 'AUTO',
        progressComputed: m.progressPct,
        status: m.status,
        statusSource: 'AUTO',
        statusAuto: m.status,
        statusReasons: m.statusReasons,
        startDate: p.startDate,
        targetUat: p.targetUat, actualUat: p.actualUat,
        targetGolive: p.targetGolive, actualGolive: p.actualGolive,
        slipDays: null,
        hasTargetGolive: p.targetGolive != null,
        counts: m.counts,
        asOfNoData: !m.hasData,
      }));
      const all = rows;
      const kpis = {
        total: all.length,
        onTrack: all.filter((r) => r.metrics.status === PROJECT_STATUS.ON_TRACK).length,
        atRisk: all.filter((r) => r.metrics.status === PROJECT_STATUS.AT_RISK).length,
        delayed: all.filter((r) => r.metrics.status === PROJECT_STATUS.DELAYED).length,
        waiting: all.filter((r) => r.metrics.status === PROJECT_STATUS.WAITING).length,
        uatThisMonth: all.filter((r) => sameBkkMonth(r.project.targetUat, now)).length,
        goliveThisMonth: all.filter((r) => sameBkkMonth(r.project.targetGolive, now)).length,
      };
      return res.json({
        asOf: asOf,
        asOfSnapshot: snapshotUsed,
        asOfHasData: snapshotUsed != null,
        lastSyncAt: await getLastSyncAt(),
        kpis,
        projects,
      });
    }
    // ── current mode ──
    const where = {};
    if (projectCode) where.projectCode = String(projectCode);
    if (pm) where.pmUserId = Number(pm); // B7: ยังไม่มี pmUserId → คืนว่าง

    let rows = await loadProjectMetrics(now, where);
    if (status) rows = rows.filter((r) => r.metrics.status === String(status));

    const projects = rows.map(({ project: p, metrics: m }) => ({
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
    }));

    // KPI 6 ใบ (§3) — นับจาก effective status
    const all = await loadProjectMetrics(now); // ทุกโปรเจกต์สำหรับ KPI (ไม่กรอง)
    const kpis = {
      total: all.length,
      onTrack: all.filter((r) => r.metrics.status === PROJECT_STATUS.ON_TRACK).length,
      atRisk: all.filter((r) => r.metrics.status === PROJECT_STATUS.AT_RISK).length,
      delayed: all.filter((r) => r.metrics.status === PROJECT_STATUS.DELAYED).length,
      waiting: all.filter((r) => r.metrics.status === PROJECT_STATUS.WAITING).length,
      uatThisMonth: all.filter((r) =>
        sameBkkMonth(r.project.targetUat, now)
      ).length,
      goliveThisMonth: all.filter((r) =>
        sameBkkMonth(r.project.targetGolive, now)
      ).length,
    };

    res.json({ asOf: now.toISOString(), lastSyncAt: await getLastSyncAt(), kpis, projects });
  } catch (err) {
    next(err);
  }
});

// GET /api/pm/milestones?days=&limit=  — ไม่ส่ง days = แสดง milestone ที่จะถึงทั้งหมด (ไม่ตัด window)
pmRouter.get('/milestones', async (req, res, next) => {
  try {
    const now = new Date();
    const days = req.query.days ? Number(req.query.days) : null; // null = ไม่จำกัดช่วง
    const limit = Number(req.query.limit ?? 12);
    const projects = await prisma.project.findMany({ where: { isActive: true } });
    const items = [];
    for (const p of projects) {
      // milestone ที่ยังไม่เกิด = มี target แต่ยังไม่มี actual
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
    res.json({ asOf: now.toISOString(), days, items: items.slice(0, limit) });
  } catch (err) {
    next(err);
  }
});

// GET /api/pm/trend?projectCodes=&weeks=12  (ราย ISO-week ค่าวันศุกร์)
pmRouter.get('/trend', async (req, res, next) => {
  try {
    const weeks = Number(req.query.weeks ?? 12);
    const codes = req.query.projectCodes ? String(req.query.projectCodes).split(',') : null;
    const projWhere = codes ? { projectCode: { in: codes } } : {};
    const projects = await prisma.project.findMany({ where: { isActive: true, ...projWhere } });
    const ids = projects.map((p) => p.id);
    const idToCode = Object.fromEntries(projects.map((p) => [p.id, p.projectCode]));

    // ดึง DailyAggregate ที่มี progressPct (สรุป project-level)
    const aggs = await prisma.dailyAggregate.findMany({
      where: { projectId: { in: ids }, progressPct: { not: null } },
      orderBy: { snapshotDate: 'asc' },
    });

    // ยุบเป็นราย ISO-week → เก็บ snapshot ล่าสุด (ใกล้ศุกร์สุด) ต่อ project ต่อสัปดาห์
    const byWeek = new Map(); // week → { code → pct }
    const weekSet = new Set();
    for (const a of aggs) {
      const wk = isoWeek(a.snapshotDate);
      weekSet.add(wk);
      if (!byWeek.has(wk)) byWeek.set(wk, {});
      byWeek.get(wk)[idToCode[a.projectId]] = a.progressPct; // ล่าสุดในสัปดาห์ชนะ (asc order)
    }
    const allWeeks = [...weekSet].sort();
    const shown = allWeeks.slice(-weeks);
    const series = shown.map((wk) => ({ week: wk, ...byWeek.get(wk) }));

    res.json({
      weeksCollected: weekSet.size, // §8 "เก็บมาแล้ว N สัปดาห์"
      needForFullTrend: 4,
      series,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/pm/attention?status=OPEN
pmRouter.get('/attention', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : 'OPEN';
    const items = await prisma.attentionItem.findMany({
      where: { status },
      orderBy: [{ neededBy: 'asc' }, { createdAt: 'desc' }],
      include: { project: { select: { projectCode: true, displayName: true } } },
    });
    res.json({ asOf: new Date().toISOString(), items });
  } catch (err) {
    next(err);
  }
});

// GET /api/pm/projects/:code/tasks?dept=&bucket=&overdue=   ← drill-down (§9)
// query เดียวกับ counts — คืน list + สรุปตาม dept/section + larkUrl (ห้ามคำนวณคนละที่)
pmRouter.get('/projects/:code/tasks', async (req, res, next) => {
  try {
    const now = new Date();
    const project = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!project) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });

    const where = { projectId: project.id, isDeleted: false };
    if (req.query.dept) where.deptCode = String(req.query.dept);
    if (req.query.bucket) where.bucketCode = String(req.query.bucket);

    let tasks = await prisma.task.findMany({ where, orderBy: { dueAt: 'asc' } });
    if (req.query.overdue === '1') {
      tasks = tasks.filter((t) => t.bucketCode !== BUCKET.DONE && isOverdue(t.dueAt, now));
    }

    const byDept = {};
    const bySection = {};
    for (const t of tasks) {
      byDept[t.deptCode] = (byDept[t.deptCode] ?? 0) + 1;
      bySection[t.sectionName] = (bySection[t.sectionName] ?? 0) + 1;
    }

    res.json({
      code: project.projectCode,
      total: tasks.length,
      byDept,
      bySection,
      items: tasks.map((t) => ({
        larkTaskGuid: t.larkTaskGuid,
        title: t.title,
        sectionName: t.sectionName,
        deptCode: t.deptCode,
        bucketCode: t.bucketCode,
        assigneeOpenIds: t.assigneeOpenIds,
        dueAt: t.dueAt,
        overdue: t.bucketCode !== BUCKET.DONE && isOverdue(t.dueAt, now),
        larkUrl: t.larkUrl ?? buildLarkTaskUrl(t.larkTaskGuid),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Lark task list endpoint ไม่คืน url → ประกอบ applink deep link จาก guid (§9 ห้ามตัดลิงก์กลับ Lark)
// ถ้า tenant ต้องการ web url เฉพาะ ปรับที่เดียวตรงนี้
function buildLarkTaskUrl(guid) {
  return `https://applink.larksuite.com/client/todo/detail?guid=${guid}`;
}

// GET /api/pm/finance — ภาพรวมการเงิน portfolio (C-level: CFO/CEO)
pmRouter.get('/finance', async (_req, res, next) => {
  try {
    const now = new Date();
    const projects = await prisma.project.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    const allInst = await prisma.paymentInstallment.findMany();
    const byProject = new Map();
    for (const i of allInst) {
      if (!byProject.has(i.projectId)) byProject.set(i.projectId, []);
      byProject.get(i.projectId).push(i);
    }

    // status ต่อ project (ใช้ตัดสิน revenue at risk)
    const statusOf = new Map();
    for (const p of projects) {
      const tasks = await prisma.task.findMany({ where: { projectId: p.id, isDeleted: false } });
      statusOf.set(p.id, computeProjectMetrics(p, tasks, now).status);
    }

    const totals = { budget: 0, billed: 0, outstanding: 0, planned: 0, unplanned: 0 };
    const cashflow = {
      overdue: { count: 0, amount: 0 },
      d0_30: { count: 0, amount: 0 },
      d31_60: { count: 0, amount: 0 },
      d61_90: { count: 0, amount: 0 },
      d90plus: { count: 0, amount: 0 },
      noDate: { count: 0, amount: 0 },
    };
    const revenueAtRisk = { amount: 0, items: [] };
    const overdueInstallments = [];

    const projectRows = projects.map((p) => {
      const inst = byProject.get(p.id) ?? [];
      const billed = inst.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.amount, 0);
      const planned = inst.reduce((a, i) => a + i.amount, 0);
      const outstanding = planned - billed;
      totals.budget += p.budget ?? 0;
      totals.billed += billed;
      totals.planned += planned;
      totals.outstanding += outstanding;
      totals.unplanned += (p.budget ?? 0) - planned;

      const status = statusOf.get(p.id);
      for (const i of inst) {
        if (i.status === 'PAID') continue;
        // cash-flow window (งวดที่ยังไม่จ่าย)
        const d = daysUntil(i.dueDate, now);
        if (d == null) cashflow.noDate.count++, (cashflow.noDate.amount += i.amount);
        else if (d < 0) {
          cashflow.overdue.count++, (cashflow.overdue.amount += i.amount);
          overdueInstallments.push({ code: p.projectCode, name: i.name, amount: i.amount, dueDate: i.dueDate, overdueDays: -d });
        } else if (d <= 30) cashflow.d0_30.count++, (cashflow.d0_30.amount += i.amount);
        else if (d <= 60) cashflow.d31_60.count++, (cashflow.d31_60.amount += i.amount);
        else if (d <= 90) cashflow.d61_90.count++, (cashflow.d61_90.amount += i.amount);
        else cashflow.d90plus.count++, (cashflow.d90plus.amount += i.amount);
        // revenue at risk — งวดที่ผูกกับ project DELAYED
        if (status === PROJECT_STATUS.DELAYED) {
          revenueAtRisk.amount += i.amount;
          revenueAtRisk.items.push({ code: p.projectCode, name: i.name, amount: i.amount, dueDate: i.dueDate });
        }
      }

      return {
        code: p.projectCode, displayName: p.displayName, status,
        budget: p.budget, billed, outstanding, planned,
        burnPct: p.budget && p.budget > 0 ? Math.round((billed / p.budget) * 100) : null,
      };
    });

    totals.burnPct = totals.budget > 0 ? Math.round((totals.billed / totals.budget) * 100) : null;
    overdueInstallments.sort((a, b) => b.overdueDays - a.overdueDays);

    res.json({ asOf: now.toISOString(), totals, projects: projectRows, cashflow, revenueAtRisk, overdueInstallments });
  } catch (err) {
    next(err);
  }
});

// GET /api/pm/projects/:code/budget — budget + งวดการเงิน + burn (req2, หน้า detail)
pmRouter.get('/projects/:code/budget', async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!project) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const installments = await prisma.paymentInstallment.findMany({
      where: { projectId: project.id },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const paid = installments.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.amount, 0);
    const planned = installments.reduce((a, i) => a + i.amount, 0);
    const burnPct = project.budget && project.budget > 0 ? Math.round((paid / project.budget) * 100) : null;
    res.json({ code: project.projectCode, budget: project.budget, installments, paid, planned, burnPct });
  } catch (err) {
    next(err);
  }
});

// ISO week label เช่น 2026-W38 — คิดขอบสัปดาห์แบบ UTC date (snapshotDate เป็น @db.Date)
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
