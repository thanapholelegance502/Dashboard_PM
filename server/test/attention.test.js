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
    const { toCreate } = computeAutoAttention(project, metrics({ status: 'DELAYED', slipDays: 7 }), [], [], now);
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

// ── C-4: งวดค้างเก็บเข้า CEO Attention ──────────────────
const inst = (over = {}) => ({
  id: 1, amount: 100_000, dueDate: new Date(now.getTime() - 10 * day),
  status: 'PENDING', ...over,
});
const call = (installments, over = {}, existing = []) =>
  computeAutoAttention(project, metrics(over), [], existing, now, installments);

describe('computeAutoAttention — งวดค้างเก็บ (C-4)', () => {
  it('เลยกำหนด ≥ 3 วัน → สร้าง PAYMENT_OVERDUE', () => {
    const { toCreate } = call([inst({ dueDate: new Date(now.getTime() - 3 * day) })]);
    const item = toCreate.find((i) => i.autoKey === 'PAYMENT_OVERDUE');
    expect(item).toBeDefined();
    expect(item.issueType).toBe('DECISION');
    expect(item.impactText).toContain('1 งวด');
    expect(item.impactText).toContain('฿100,000');
  });

  it('เลยกำหนด 2 วัน → ยังไม่เตือน', () => {
    const { toCreate } = call([inst({ dueDate: new Date(now.getTime() - 2 * day) })]);
    expect(toCreate.map((i) => i.autoKey)).not.toContain('PAYMENT_OVERDUE');
  });

  it('จ่ายแล้ว / ยังไม่ถึงกำหนด / ไม่มีวันครบกำหนด → ไม่เตือน', () => {
    const items = [
      inst({ id: 1, status: 'PAID' }),
      inst({ id: 2, dueDate: new Date(now.getTime() + 30 * day) }),
      inst({ id: 3, dueDate: null }),
    ];
    expect(call(items).toCreate.map((i) => i.autoKey)).not.toContain('PAYMENT_OVERDUE');
  });

  it('หลายงวด → รวมยอด + ใช้จำนวนวันที่มากสุด + neededBy = ครบกำหนดเก่าสุด', () => {
    const items = [
      inst({ id: 1, amount: 200_000, dueDate: new Date(now.getTime() - 5 * day) }),
      inst({ id: 2, amount: 300_000, dueDate: new Date(now.getTime() - 44 * day) }),
      inst({ id: 3, amount: 999, dueDate: new Date(now.getTime() - 1 * day) }), // ยังไม่ถึง 3 วัน
    ];
    const item = call(items).toCreate.find((i) => i.autoKey === 'PAYMENT_OVERDUE');
    expect(item.impactText).toContain('2 งวด');
    expect(item.impactText).toContain('฿500,000');
    expect(item.impactText).toContain('44 วัน');
    expect(item.neededBy.getTime()).toBe(items[1].dueDate.getTime());
  });

  it('โปรเจกต์ DONE → เรื่องงานเงียบ แต่เรื่องเงินยังเตือน', () => {
    const existing = [{ id: 7, autoKey: 'DELAYED', source: 'AUTO', status: 'OPEN' }];
    const { toCreate, toResolveIds } = call([inst()], { status: 'DONE' }, existing);
    expect(toCreate.map((i) => i.autoKey)).toEqual(['PAYMENT_OVERDUE']);
    expect(toResolveIds).toEqual([7]); // DELAYED เดิมถูกปิด
  });

  it('เก็บเงินครบ → auto-resolve', () => {
    const existing = [{ id: 8, autoKey: 'PAYMENT_OVERDUE', source: 'AUTO', status: 'OPEN', impactText: 'x' }];
    const { toResolveIds } = call([inst({ status: 'PAID' })], {}, existing);
    expect(toResolveIds).toEqual([8]);
  });
});

describe('computeAutoAttention — อัพเดตข้อความเมื่อตัวเลขขยับ', () => {
  it('เปิดอยู่แล้วและข้อความเท่าเดิม → ไม่ทำอะไร', () => {
    const first = call([inst()]).toCreate[0];
    const existing = [{ id: 5, autoKey: 'PAYMENT_OVERDUE', source: 'AUTO', status: 'OPEN', impactText: first.impactText, neededBy: first.neededBy }];
    const { toCreate, toUpdate } = call([inst()], {}, existing);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
  });

  it('เลยกำหนดเพิ่มวัน → อัพเดตข้อความ ไม่สร้างใหม่', () => {
    const existing = [{
      id: 5, autoKey: 'PAYMENT_OVERDUE', source: 'AUTO', status: 'OPEN',
      impactText: '1 งวด · ฿100,000 · เลยกำหนดสูงสุด 3 วัน',
      neededBy: new Date(now.getTime() - 10 * day),
    }];
    const { toCreate, toUpdate } = call([inst()], {}, existing);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(1);
    expect(toUpdate[0]).toMatchObject({ id: 5 });
    expect(toUpdate[0].impactText).toContain('10 วัน');
  });
});
