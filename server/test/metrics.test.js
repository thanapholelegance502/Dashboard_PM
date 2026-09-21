import { describe, it, expect } from 'vitest';
import { computeProjectMetrics } from '../src/domain/metrics.js';
import { transformTask } from '../src/etl/transform.js';
import { buildAusSilver, RULES } from './fixtures.js';

const now = new Date('2026-09-18T05:00:00Z');
const day = 24 * 60 * 60 * 1000;

function ausTasks() {
  const { tasks } = buildAusSilver();
  return tasks.map((raw) => transformTask(raw, { projectId: 1, rules: RULES }));
}

describe('computeProjectMetrics (AUS_SILVER)', () => {
  const tasks = ausTasks();

  it('progress 54% + counts ตรง regression', () => {
    const m = computeProjectMetrics({ id: 1 }, tasks, now);
    expect(m.progressPct).toBe(54);
    expect(m.counts.total).toBe(132);
    expect(m.counts.blocked).toBe(0);
  });

  it('ไม่มี date + ไม่ blocker → ON_TRACK', () => {
    const m = computeProjectMetrics({ id: 1 }, tasks, now);
    expect(m.status).toBe('ON_TRACK');
    expect(m.statusSource).toBe('AUTO');
  });

  it('progress override สด → ใช้ override + source OVERRIDE', () => {
    const project = { id: 1, progressOverride: 90, progressOverrideAt: new Date(now.getTime() - 2 * day) };
    const m = computeProjectMetrics(project, tasks, now);
    expect(m.progressPct).toBe(90);
    expect(m.progressSource).toBe('OVERRIDE');
    expect(m.progressComputed).toBe(54); // ยังเก็บค่าคำนวณไว้โชว์ tooltip
  });

  it('progress override หมดอายุ 14 วัน → กลับไปค่าคำนวณ', () => {
    const project = { id: 1, progressOverride: 90, progressOverrideAt: new Date(now.getTime() - 20 * day) };
    const m = computeProjectMetrics(project, tasks, now);
    expect(m.progressPct).toBe(54);
    expect(m.progressSource).toBe('AUTO');
    expect(m.progressOverrideExpired).toBe(true);
  });

  it('status override สด ชนะ auto', () => {
    const project = { id: 1, statusOverride: 'ON_TRACK', statusOverrideAt: new Date(now.getTime() - day) };
    const blocked = tasks.map((t, i) => (i === 0 ? { ...t, bucketCode: 'BLOCKED' } : t));
    const m = computeProjectMetrics(project, blocked, now);
    expect(m.statusAuto).toBe('AT_RISK'); // auto เห็น blocker
    expect(m.status).toBe('ON_TRACK'); // override ชนะ
    expect(m.statusSource).toBe('OVERRIDE');
  });
});
