// Meta routes — health + info พื้นฐาน (P1) + section ที่ยังไม่ map (Admin banner MASTER §5)
import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { DEPT, BUCKET } from '../../domain/enums.js';

export const metaRouter = Router();

metaRouter.get('/health', (_req, res) => res.json({ ok: true }));

// GET /api/meta/projects — รายชื่อโปรเจกต์ (P1 minimal)
metaRouter.get('/projects', async (_req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, projectCode: true, displayName: true, isActive: true, larkTasklistGuid: true },
    });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// GET /api/meta/members
metaRouter.get('/members', async (_req, res, next) => {
  try {
    res.json(await prisma.member.findMany({ orderBy: { displayName: 'asc' } }));
  } catch (err) {
    next(err);
  }
});

// GET /api/meta/sections — section ที่เจอจริง + mapping ปัจจุบัน + count
metaRouter.get('/sections', async (_req, res, next) => {
  try {
    const rows = await prisma.task.groupBy({
      by: ['projectId', 'sectionName', 'deptCode', 'bucketCode'],
      where: { isDeleted: false },
      _count: { _all: true },
    });
    res.json(
      rows.map((r) => ({
        projectId: r.projectId,
        sectionName: r.sectionName,
        deptCode: r.deptCode,
        bucketCode: r.bucketCode,
        cardCount: r._count._all,
        mapped: r.deptCode !== DEPT.NONE,
      }))
    );
  } catch (err) {
    next(err);
  }
});

// GET /api/meta/unmapped-sections — section ที่ dept=NONE (ต้องขึ้น banner เตือน — MASTER §5)
metaRouter.get('/unmapped-sections', async (_req, res, next) => {
  try {
    // unmapped จริง = fallback (NONE/BACKLOG) เท่านั้น — Blocker (NONE/BLOCKED) ตั้งใจ ไม่นับ
    const rows = await prisma.task.groupBy({
      by: ['projectId', 'sectionName'],
      where: { isDeleted: false, deptCode: DEPT.NONE, bucketCode: BUCKET.BACKLOG },
      _count: { _all: true },
    });
    res.json(
      rows.map((r) => ({
        projectId: r.projectId,
        sectionName: r.sectionName,
        cardCount: r._count._all,
      }))
    );
  } catch (err) {
    next(err);
  }
});
