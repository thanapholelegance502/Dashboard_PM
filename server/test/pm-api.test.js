// API integration — boot app จริง ยิงผ่าน HTTP (ต้องมี DB + ข้อมูล sync แล้ว)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '../src/index.js';
import { prisma } from '../src/db/prisma.js';

let server;
let base;

beforeAll(async () => {
  server = http.createServer(createApp());
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  // คืนค่า override ที่ test เขียน กัน DB เพี้ยน
  await prisma.project.updateMany({
    where: { projectCode: 'AUS_SILVER' },
    data: { statusOverride: null, statusOverrideReason: null, statusOverrideBy: null, statusOverrideAt: null },
  });
  await new Promise((r) => server.close(r));
});

const get = (p) => fetch(`${base}${p}`).then(async (r) => ({ status: r.status, body: await r.json() }));
const post = (p, data) =>
  fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(
    async (r) => ({ status: r.status, body: await r.json() })
  );

describe('PM API (dev auth = ADMIN)', () => {
  it('portfolio: AUS_SILVER 132 ใบ + kpis ครบ', async () => {
    const { status, body } = await get('/api/pm/portfolio');
    expect(status).toBe(200);
    expect(body.kpis.total).toBeGreaterThanOrEqual(3);
    const aus = body.projects.find((p) => p.code === 'AUS_SILVER');
    expect(aus).toBeTruthy();
    expect(aus.counts.total).toBe(132);
    expect(aus.statusReasons.length).toBeGreaterThan(0);
  });

  it('drill-down parity: bucket=BLOCKED count == portfolio counts.blocked', async () => {
    const port = await get('/api/pm/portfolio?projectCode=MYGOLD_BSEA');
    const mg = port.body.projects.find((p) => p.code === 'MYGOLD_BSEA');
    const drill = await get('/api/pm/projects/MYGOLD_BSEA/tasks?bucket=BLOCKED');
    expect(drill.body.total).toBe(mg.counts.blocked); // query เดียวกัน (MASTER §12.2)
    expect(drill.body.items.every((i) => i.bucketCode === 'BLOCKED')).toBe(true);
  });

  it('drill-down มี larkUrl + สรุปตาม dept/section', async () => {
    const { body } = await get('/api/pm/projects/AUS_SILVER/tasks?dept=QA');
    expect(body.byDept.QA).toBe(body.total);
    expect(body.items[0]).toHaveProperty('larkUrl');
  });

  it('status-override: ไม่มี reason → 400', async () => {
    const { status } = await post('/api/admin/projects/AUS_SILVER/status-override', { status: 'ON_TRACK' });
    expect(status).toBe(400);
  });

  it('status-override: reason ครบ → 200 + ลง AuditLog', async () => {
    const before = await prisma.auditLog.count({ where: { action: 'OVERRIDE' } });
    const { status, body } = await post('/api/admin/projects/AUS_SILVER/status-override', {
      status: 'AT_RISK',
      reason: 'ทดสอบ override เหตุผลยาวพอ',
    });
    expect(status).toBe(200);
    expect(body.statusOverride).toBe('AT_RISK');
    const after = await prisma.auditLog.count({ where: { action: 'OVERRIDE' } });
    expect(after).toBe(before + 1);
  });
});
