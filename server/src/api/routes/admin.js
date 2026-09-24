// Admin API — 02-PM-DASHBOARD §10-11 · ทุก mutation ลง AuditLog (MASTER §12.6)
import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { requireRole } from '../middleware/auth.js';
import { writeAudit } from '../../domain/audit.js';
import { fetchSections, fetchAllTasks } from '../../lark/tasks.js';
import { PROJECT_STATUS } from '../../domain/enums.js';
import { resolveSectionRule } from '../../domain/bucket.js';
import { recomputeMetricsAndAttention } from '../../etl/postprocess.js';
import { normalizeNewUser, assertUserChangeAllowed } from '../../domain/users.js';
import { normalizeBoards } from '../../domain/boards.js';

export const adminRouter = Router();
adminRouter.use(requireRole('ADMIN', 'PM')); // ทุก endpoint ต้อง ADMIN|PM

const uid = (req) => req.user?.id ?? null;

/**
 * recompute dept/bucket/weight ของทุก task จาก rule ปัจจุบัน — ไม่ยิง Lark
 * ใช้หลังแก้ section rule (task เก็บ sectionName ไว้แล้ว)
 */
async function recomputeAllTasks() {
  const rules = await prisma.sectionRule.findMany();
  const tasks = await prisma.task.findMany({ where: { isDeleted: false }, select: { id: true, sectionName: true, projectId: true, deptCode: true, bucketCode: true, sectionWeight: true } });
  let changed = 0;
  for (const t of tasks) {
    const r = resolveSectionRule(t.sectionName, rules, t.projectId);
    if (r.deptCode !== t.deptCode || r.bucketCode !== t.bucketCode || r.weight !== t.sectionWeight) {
      await prisma.task.update({ where: { id: t.id }, data: { deptCode: r.deptCode, bucketCode: r.bucketCode, sectionWeight: r.weight } });
      changed += 1;
    }
  }
  await recomputeMetricsAndAttention();
  const unmapped = await prisma.task.count({ where: { isDeleted: false, deptCode: 'NONE', bucketCode: 'BACKLOG' } });
  return { total: tasks.length, changed, unmapped };
}

// ── Projects ────────────────────────────────────────────
adminRouter.get('/projects', async (_req, res, next) => {
  try {
    res.json(await prisma.project.findMany({ orderBy: { sortOrder: 'asc' } }));
  } catch (e) {
    next(e);
  }
});

const PROJECT_DATE_FIELDS = ['startDate', 'targetUat', 'targetGolive', 'forecastUat', 'forecastGolive', 'actualUat', 'actualGolive'];
function pickProjectData(body) {
  const data = {};
  for (const k of ['projectCode', 'displayName', 'larkTasklistGuid', 'pmUserId', 'isActive', 'sortOrder', 'budget']) {
    if (body[k] !== undefined) data[k] = body[k] === null ? null : body[k];
  }
  for (const k of PROJECT_DATE_FIELDS) {
    if (body[k] !== undefined) data[k] = body[k] ? new Date(body[k]) : null;
  }
  return data;
}

adminRouter.post('/projects', async (req, res, next) => {
  try {
    const data = pickProjectData(req.body);
    if (!data.projectCode || !data.larkTasklistGuid) {
      return res.status(400).json({ error: 'ต้องมี projectCode + larkTasklistGuid' });
    }
    if (!data.displayName) data.displayName = data.projectCode;
    const created = await prisma.project.create({ data });
    await writeAudit({ appUserId: uid(req), entity: 'Project', entityId: created.id, action: 'CREATE', after: data });
    res.json(created);
  } catch (e) {
    if (e.code === 'P2002') {
      // unique constraint — projectCode หรือ larkTasklistGuid ซ้ำ
      const field = e.meta?.target?.includes('larkTasklistGuid') ? 'tasklist guid' : 'project code';
      return res.status(409).json({ error: `${field} นี้มีอยู่แล้ว` });
    }
    next(e);
  }
});

adminRouter.patch('/projects/:code', async (req, res, next) => {
  try {
    const before = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!before) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const data = pickProjectData(req.body);
    delete data.projectCode; // ห้ามแก้ code
    const updated = await prisma.project.update({ where: { id: before.id }, data });
    await writeAudit({ appUserId: uid(req), entity: 'Project', entityId: before.id, action: 'UPDATE', before, after: data });
    await recomputeMetricsAndAttention(); // แก้ date → status/attention อัพเดตทันที (ไม่ต้องรอ sync)
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /projects/:code/test-connection — ยิง Lark นับการ์ด (§10 แท็บ1)
adminRouter.post('/projects/:code/test-connection', async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!p) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const sectionMap = await fetchSections(p.larkTasklistGuid);
    const { tasks } = await fetchAllTasks(sectionMap);
    res.json({ ok: true, sections: sectionMap.size, cards: tasks.length });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.reauthorize ? 'ต้อง re-authorize Lark' : e.message });
  }
});

// ── Status / Progress override (§5.2, §4) ───────────────
adminRouter.post('/projects/:code/status-override', async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!Object.values(PROJECT_STATUS).includes(status)) {
      return res.status(400).json({ error: 'status ไม่ถูกต้อง' });
    }
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'ต้องกรอกเหตุผลอย่างน้อย 10 ตัวอักษร' });
    }
    const p = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!p) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const updated = await prisma.project.update({
      where: { id: p.id },
      data: { statusOverride: status, statusOverrideReason: reason, statusOverrideBy: uid(req), statusOverrideAt: new Date() },
    });
    await writeAudit({
      appUserId: uid(req), entity: 'Project', entityId: p.id, action: 'OVERRIDE',
      before: { statusOverride: p.statusOverride }, after: { statusOverride: status }, reason,
    });
    await recomputeMetricsAndAttention();
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/projects/:code/progress-override', async (req, res, next) => {
  try {
    const { progress, reason } = req.body;
    const n = Number(progress);
    if (!Number.isInteger(n) || n < 0 || n > 100) {
      return res.status(400).json({ error: 'progress ต้องเป็น 0-100' });
    }
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'ต้องกรอกเหตุผลอย่างน้อย 10 ตัวอักษร' });
    }
    const p = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!p) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const updated = await prisma.project.update({
      where: { id: p.id },
      data: { progressOverride: n, progressOverrideReason: reason, progressOverrideBy: uid(req), progressOverrideAt: new Date() },
    });
    await writeAudit({
      appUserId: uid(req), entity: 'Project', entityId: p.id, action: 'OVERRIDE',
      before: { progressOverride: p.progressOverride }, after: { progressOverride: n }, reason,
    });
    await recomputeMetricsAndAttention();
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ── Section Rules ───────────────────────────────────────
adminRouter.get('/section-rules', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.projectId) where.projectId = Number(req.query.projectId);
    res.json(await prisma.sectionRule.findMany({ where, orderBy: [{ priority: 'asc' }, { id: 'asc' }] }));
  } catch (e) {
    next(e);
  }
});

function pickRuleData(body) {
  const data = {};
  for (const k of ['matchType', 'pattern', 'deptCode', 'bucketCode', 'weight', 'priority', 'projectId', 'isActive']) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  return data;
}

adminRouter.post('/section-rules', async (req, res, next) => {
  try {
    const data = pickRuleData(req.body);
    const created = await prisma.sectionRule.create({ data });
    await writeAudit({ appUserId: uid(req), entity: 'SectionRule', entityId: created.id, action: 'CREATE', after: data });
    res.json(created);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/section-rules/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.sectionRule.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'ไม่พบ rule' });
    const updated = await prisma.sectionRule.update({ where: { id }, data: pickRuleData(req.body) });
    await writeAudit({ appUserId: uid(req), entity: 'SectionRule', entityId: id, action: 'UPDATE', before, after: req.body });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

adminRouter.delete('/section-rules/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.sectionRule.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'ไม่พบ rule' });
    await prisma.sectionRule.delete({ where: { id } });
    await writeAudit({ appUserId: uid(req), entity: 'SectionRule', entityId: id, action: 'DELETE', before });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/recompute — apply rule ปัจจุบันกับ task ทุกใบ (ไม่ยิง Lark) หลังแก้ rule
adminRouter.post('/recompute', async (_req, res, next) => {
  try {
    res.json(await recomputeAllTasks());
  } catch (e) {
    next(e);
  }
});

// ── Members (tag deptCode/nickname — B5) ────────────────
adminRouter.get('/members', async (_req, res, next) => {
  try {
    res.json(await prisma.member.findMany({ orderBy: { displayName: 'asc' } }));
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/members/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.member.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'ไม่พบสมาชิก' });
    const data = {};
    for (const k of ['deptCode', 'nickname', 'isActive']) if (req.body[k] !== undefined) data[k] = req.body[k];
    const updated = await prisma.member.update({ where: { id }, data });
    await writeAudit({ appUserId: uid(req), entity: 'Member', entityId: id, action: 'UPDATE', before, after: data });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ── Attention Items (MANUAL) ────────────────────────────
adminRouter.get('/attention-items', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    res.json(await prisma.attentionItem.findMany({ where, orderBy: { createdAt: 'desc' } }));
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/attention-items', async (req, res, next) => {
  try {
    const { projectId, title, issueType, impactText, neededBy } = req.body;
    if (!projectId || !title) return res.status(400).json({ error: 'ต้องมี projectId + title' });
    const created = await prisma.attentionItem.create({
      data: {
        projectId: Number(projectId), title, issueType: issueType ?? 'DECISION',
        impactText: impactText ?? '', neededBy: neededBy ? new Date(neededBy) : null,
        source: 'MANUAL', status: 'OPEN', createdBy: uid(req),
      },
    });
    await writeAudit({ appUserId: uid(req), entity: 'AttentionItem', entityId: created.id, action: 'CREATE', after: req.body });
    res.json(created);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/attention-items/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.attentionItem.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'ไม่พบ item' });
    const data = {};
    for (const k of ['title', 'issueType', 'impactText', 'status']) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (req.body.neededBy !== undefined) data.neededBy = req.body.neededBy ? new Date(req.body.neededBy) : null;
    if (data.status === 'RESOLVED' && before.status !== 'RESOLVED') data.resolvedAt = new Date();
    const updated = await prisma.attentionItem.update({ where: { id }, data });
    await writeAudit({ appUserId: uid(req), entity: 'AttentionItem', entityId: id, action: 'UPDATE', before, after: data });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ── Payment Installments (งวดการเงิน — req2) ────────────
adminRouter.get('/projects/:code/installments', async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!p) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const items = await prisma.paymentInstallment.findMany({
      where: { projectId: p.id },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json({ budget: p.budget, installments: items });
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/projects/:code/installments', async (req, res, next) => {
  try {
    const p = await prisma.project.findUnique({ where: { projectCode: req.params.code } });
    if (!p) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    const { name, amount, dueDate, sortOrder } = req.body;
    if (!name || amount == null) return res.status(400).json({ error: 'ต้องมีชื่องวด + จำนวนเงิน' });
    const created = await prisma.paymentInstallment.create({
      data: {
        projectId: p.id, name, amount: Number(amount),
        dueDate: dueDate ? new Date(dueDate) : null, sortOrder: sortOrder ?? 0,
      },
    });
    await writeAudit({ appUserId: uid(req), entity: 'PaymentInstallment', entityId: created.id, action: 'CREATE', after: req.body });
    res.json(created);
  } catch (e) {
    next(e);
  }
});

adminRouter.patch('/installments/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.paymentInstallment.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'ไม่พบงวด' });
    const data = {};
    for (const k of ['name', 'amount', 'status', 'sortOrder']) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (req.body.dueDate !== undefined) data.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    if (data.amount != null) data.amount = Number(data.amount);
    // toggle จ่ายแล้ว → set paidAt
    if (data.status === 'PAID' && before.status !== 'PAID') data.paidAt = new Date();
    if (data.status === 'PENDING') data.paidAt = null;
    const updated = await prisma.paymentInstallment.update({ where: { id }, data });
    await writeAudit({ appUserId: uid(req), entity: 'PaymentInstallment', entityId: id, action: 'UPDATE', before, after: data });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

adminRouter.delete('/installments/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.paymentInstallment.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'ไม่พบงวด' });
    await prisma.paymentInstallment.delete({ where: { id } });
    await writeAudit({ appUserId: uid(req), entity: 'PaymentInstallment', entityId: id, action: 'DELETE', before });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── ผู้ใช้ (AppUser whitelist) — ADMIN เท่านั้น (PM ห้ามตั้ง role ตัวเอง) ──
// ไม่มี DELETE: ใช้ปิดใช้งานแทน เพื่อให้ AuditLog ยังอ้างถึงคนได้
const adminOnly = requireRole('ADMIN');
const userRow = (u) => ({
  id: u.id, email: u.email, displayName: u.displayName, role: u.role, isActive: u.isActive, linked: !!u.larkOpenId,
  boards: u.boards ?? [],
});

adminRouter.get('/users', adminOnly, async (_req, res, next) => {
  try {
    const users = await prisma.appUser.findMany({ orderBy: [{ isActive: 'desc' }, { email: 'asc' }] });
    res.json(users.map(userRow));
  } catch (e) {
    next(e);
  }
});

adminRouter.post('/users', adminOnly, async (req, res, next) => {
  try {
    const data = normalizeNewUser(req.body);
    if (req.body.boards !== undefined) data.boards = normalizeBoards(req.body.boards);
    const created = await prisma.appUser.create({ data });
    await writeAudit({ appUserId: uid(req), entity: 'AppUser', entityId: created.id, action: 'CREATE', after: data });
    res.json(userRow(created));
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'มีอีเมลนี้ในระบบแล้ว' });
    next(e);
  }
});

adminRouter.patch('/users/:id', adminOnly, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const before = await prisma.appUser.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    const data = {};
    if (req.body.role !== undefined) data.role = String(req.body.role).toUpperCase();
    if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
    if (req.body.displayName !== undefined) data.displayName = String(req.body.displayName).trim() || before.displayName;
    if (req.body.boards !== undefined) data.boards = normalizeBoards(req.body.boards);
    const activeAdminCount = await prisma.appUser.count({ where: { role: 'ADMIN', isActive: true } });
    assertUserChangeAllowed({ actorId: uid(req), target: before, change: data, activeAdminCount });
    const updated = await prisma.appUser.update({ where: { id }, data });
    await writeAudit({ appUserId: uid(req), entity: 'AppUser', entityId: id, action: 'UPDATE', before: userRow(before), after: data });
    res.json(userRow(updated));
  } catch (e) {
    next(e);
  }
});
