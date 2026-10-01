// บอร์ด YOK — Project Executive Dashboard (อ่าน Google Sheet ฝั่ง server)
// payload เดียวต่อหน้า → ทุก section มาจาก snapshot เดียว asOf เดียว (MASTER §12.2)
import { Router } from 'express';
import { isYokEnabled } from '../../config/env.js';
import { getYokBoard, getYokMeta, invalidateYokCache } from '../../sheets/yokSource.js';
import { requireRole } from '../middleware/auth.js';

export const yokRouter = Router();

function guardEnabled(_req, res, next) {
  if (!isYokEnabled()) {
    return res.status(503).json({ error: 'บอร์ดนี้ยังไม่ได้ตั้งค่า (ขาด YOK_SHEET_ID หรือ service account key)' });
  }
  next();
}

yokRouter.get('/dashboard', guardEnabled, async (_req, res, next) => {
  try {
    res.json(await getYokBoard());
  } catch (err) {
    next(err);
  }
});

// ADMIN เท่านั้น · คืนโครงสร้างล้วน ไม่มีแถวข้อมูล (ชีตมีชื่อลูกค้าจริง)
yokRouter.get('/meta', guardEnabled, requireRole('ADMIN'), async (_req, res, next) => {
  try {
    res.json(await getYokMeta());
  } catch (err) {
    next(err);
  }
});

yokRouter.post('/refresh', guardEnabled, requireRole('ADMIN', 'PM'), (_req, res) => {
  invalidateYokCache();
  res.json({ ok: true });
});
