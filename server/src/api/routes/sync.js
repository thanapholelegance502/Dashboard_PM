// Sync routes (MASTER §8)
import { Router } from 'express';
import { runSync } from '../../etl/runSync.js';
import { writeSnapshot } from '../../etl/snapshot.js';
import { prisma } from '../../db/prisma.js';
import { requireRole } from '../middleware/auth.js';

export const syncRouter = Router();

// POST /api/sync/run — ADMIN|PM, มี lock กันกดซ้อน (อยู่ใน runSync)
syncRouter.post('/run', requireRole('ADMIN', 'PM'), async (req, res, next) => {
  try {
    const withSnapshot = req.query.snapshot === '1' || req.body?.snapshot === true;
    const result = await runSync({ trigger: 'MANUAL' });
    let snapshot = null;
    if (withSnapshot) snapshot = await writeSnapshot();
    res.json({ ...result, snapshot });
  } catch (err) {
    next(err);
  }
});

// POST /api/sync/snapshot — สร้าง snapshot วันนี้ด้วยมือ (ADMIN) §11
syncRouter.post('/snapshot', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    res.json(await writeSnapshot());
  } catch (err) {
    next(err);
  }
});

// GET /api/sync/status — สถานะ sync ล่าสุด + banner เตือนข้อมูลเก่า/ต้อง reauthorize
syncRouter.get('/status', async (_req, res, next) => {
  try {
    const last = await prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } });
    const lastSuccess = await prisma.syncRun.findFirst({
      where: { status: { in: ['SUCCESS', 'PARTIAL'] } },
      orderBy: { startedAt: 'desc' },
    });
    const staleMs = 24 * 60 * 60 * 1000;
    const isStale = !lastSuccess || Date.now() - lastSuccess.finishedAt?.getTime() > staleMs;
    const needReauthorize = last?.errorText?.includes('REAUTHORIZE_REQUIRED') ?? false;
    res.json({ last, lastSuccess, isStale, needReauthorize });
  } catch (err) {
    next(err);
  }
});
