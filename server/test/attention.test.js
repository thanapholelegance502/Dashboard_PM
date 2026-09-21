import { describe, it, expect } from 'vitest';
import { computeAutoAttention } from '../src/domain/attention.js';

const now = new Date('2026-09-18T05:00:00Z');
const day = 24 * 60 * 60 * 1000;
const project = { id: 1 };

const metrics = (over = {}) => ({
  status: 'ON_TRACK',
  slipDays: null,
  counts: { open: 40, overdue: 0, blocked: 0, done: 0, total: 40 },
  ...over,
});

describe('computeAutoAttention (02-PM §7)', () => {
  it('DELAYED → สร้าง item DELAYED', () => {
    const { toCreate } = computeAutoAttention(project, metrics({ status: 'DELAYED', slipDays: -7 }), [], [], now);
    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].autoKey).toBe('DELAYED');
    expect(toCreate[0].impactText).toContain('7 วัน');
  });

  it('มี item DELAYED เปิดอยู่แล้ว → ไม่สร้างซ้ำ', () => {
    const existing = [{ id: 9, autoKey: 'DELAYED', source: 'AUTO', status: 'OPEN' }];
    const { toCreate } = computeAutoAttention(project, metrics({ status: 'DELAYED' }), [], existing, now);
    expect(toCreate).toHaveLength(0);
  });

  it('เงื่อนไขหายไป → auto-resolve', () => {
    const existing = [{ id: 9, autoKey: 'DELAYED', source: 'AUTO', status: 'OPEN' }];
    const { toResolveIds } = computeAutoAttention(project, metrics(), [], existing, now);
    expect(toResolveIds).toEqual([9]);
  });

  it('BLOCKED ค้าง > 3 วัน → สร้าง BLOCKED_STALE', () => {
    const tasks = [
      { bucketCode: 'BLOCKED', larkUpdatedAt: new Date(now.getTime() - 5 * day), isDeleted: false },
      { bucketCode: 'BLOCKED', larkUpdatedAt: new Date(now.getTime() - day), isDeleted: false }, // ยังใหม่
    ];
    const { toCreate } = computeAutoAttention(project, metrics({ counts: { open: 40, overdue: 0, blocked: 2 } }), tasks, [], now);
    const keys = toCreate.map((i) => i.autoKey);
    expect(keys).toContain('BLOCKED_STALE');
  });

  it('overdue > 20% → สร้าง OVERDUE', () => {
    const { toCreate } = computeAutoAttention(project, metrics({ counts: { open: 40, overdue: 10, blocked: 0 } }), [], [], now);
    expect(toCreate.map((i) => i.autoKey)).toContain('OVERDUE');
  });
});
