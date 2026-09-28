import { describe, it, expect } from 'vitest';
import { computeFinance, CASHFLOW_BUCKETS } from '../src/domain/finance.js';
import { PROJECT_STATUS } from '../src/domain/enums.js';

// ตรึงเวลา — 18:00 กรุงเทพ ของ 2026-09-28 (ขอบวันไวต่อ timezone จงใจเลือกช่วงเย็น)
const now = new Date('2026-09-28T11:00:00Z');
const day = 24 * 60 * 60 * 1000;

/** วันครบกำหนดที่ห่างจากวันนี้ d วัน — ตั้งเป็น 23:30 เวลาไทย เพื่อจับ off-by-one */
function due(d) {
  return new Date(new Date('2026-09-28T16:30:00Z').getTime() + d * day);
}

const projects = [
  { id: 1, projectCode: 'PRJ_ALPHA', displayName: 'Alpha', budget: 1_000_000, sortOrder: 1 },
  { id: 2, projectCode: 'PRJ_BETA', displayName: 'Beta', budget: 500_000, sortOrder: 2 },
  { id: 3, projectCode: 'PRJ_GAMMA', displayName: 'Gamma', budget: null, sortOrder: 3 },
];

const statusOf = new Map([
  [1, PROJECT_STATUS.ON_TRACK],
  [2, PROJECT_STATUS.DELAYED],
  [3, PROJECT_STATUS.ON_TRACK],
]);

const installments = [
  // Alpha: ตั้งงวด 800k จาก budget 1.0M → unplanned 200k
  { id: 11, projectId: 1, name: 'งวด 1 · มัดจำ', amount: 300_000, dueDate: due(-10), status: 'PAID', paidAt: new Date('2026-09-10T03:00:00Z'), sortOrder: 1 },
  { id: 12, projectId: 1, name: 'งวดที่2', amount: 200_000, dueDate: due(-1), status: 'PENDING', paidAt: null, sortOrder: 2 },
  { id: 13, projectId: 1, name: 'UAT', amount: 200_000, dueDate: due(30), status: 'PENDING', paidAt: null, sortOrder: 3 },
  { id: 14, projectId: 1, name: 'Go-live', amount: 100_000, dueDate: null, status: 'PENDING', paidAt: null, sortOrder: 4 },
  // Beta (DELAYED): ตั้งงวด 700k จาก budget 500k → overPlanned 200k
  { id: 21, projectId: 2, name: 'งวด 1', amount: 400_000, dueDate: due(31), status: 'PENDING', paidAt: null, sortOrder: 1 },
  { id: 22, projectId: 2, name: 'งวด 2', amount: 300_000, dueDate: due(91), status: 'PENDING', paidAt: null, sortOrder: 2 },
  // Gamma: ยังไม่ใส่มูลค่างาน
  { id: 31, projectId: 3, name: 'งวด 1', amount: 50_000, dueDate: due(61), status: 'PENDING', paidAt: null, sortOrder: 1 },
];

const r = computeFinance({ projects, installments, statusOf, now });
const byCode = (c) => r.installments.filter((i) => i.code === c);

describe('computeFinance — invariant §12.2 (KPI กับ list มาจาก query เดียวกัน)', () => {
  it('ทุก bucket: ยอดรวมของ items === ยอดบนการ์ด', () => {
    for (const k of CASHFLOW_BUCKETS) {
      const its = r.installments.filter((i) => i.bucket === k);
      expect(its.length, k).toBe(r.cashflow[k].count);
      expect(its.reduce((a, i) => a + i.amount, 0), k).toBe(r.cashflow[k].amount);
    }
  });

  it('งวดที่จ่ายแล้วไม่เข้า bucket ไหนเลย', () => {
    const paid = r.installments.filter((i) => i.bucket === 'paid');
    expect(paid.map((i) => i.id)).toEqual([11]);
    const inBuckets = CASHFLOW_BUCKETS.reduce((a, k) => a + r.cashflow[k].count, 0);
    expect(inBuckets).toBe(r.installments.length - paid.length);
  });

  it('ปิดวง: งวดที่ยังไม่จ่ายทั้งหมด === totals.outstanding', () => {
    const unpaid = r.installments.filter((i) => i.status !== 'PAID').reduce((a, i) => a + i.amount, 0);
    expect(unpaid).toBe(r.totals.outstanding);
    // แท่งทั้ง 6 (รวม noDate) ต้องบวกกันได้เท่า ค้างเก็บ
    expect(CASHFLOW_BUCKETS.reduce((a, k) => a + r.cashflow[k].amount, 0)).toBe(r.totals.outstanding);
  });

  it('parity ต่อ project: billed / planned ตรงกับรายการของโครงการนั้น', () => {
    for (const row of r.projects) {
      const its = byCode(row.code);
      expect(its.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.amount, 0)).toBe(row.billed);
      expect(its.reduce((a, i) => a + i.amount, 0)).toBe(row.planned);
    }
  });

  it('overdueInstallments ตรงกับ bucket overdue', () => {
    expect(r.overdueInstallments.map((i) => i.id).sort()).toEqual(
      r.installments.filter((i) => i.bucket === 'overdue').map((i) => i.id).sort(),
    );
  });

  it('atRisk ตรงกับ revenueAtRisk', () => {
    const at = r.installments.filter((i) => i.atRisk);
    expect(at.reduce((a, i) => a + i.amount, 0)).toBe(r.revenueAtRisk.amount);
    expect(at.length).toBe(r.revenueAtRisk.items.length);
    // เฉพาะงวดที่ยังไม่จ่ายของโครงการ DELAYED
    expect(at.map((i) => i.id).sort()).toEqual([21, 22]);
  });
});

describe('computeFinance — ขอบ bucket', () => {
  const cases = [
    [-1, 'overdue'], [0, 'd0_30'], [30, 'd0_30'],
    [31, 'd31_60'], [60, 'd31_60'],
    [61, 'd61_90'], [90, 'd61_90'],
    [91, 'd90plus'],
  ];
  for (const [d, bucket] of cases) {
    it(`d=${d} → ${bucket}`, () => {
      const out = computeFinance({
        projects: [projects[0]],
        installments: [{ id: 1, projectId: 1, name: 'x', amount: 1, dueDate: due(d), status: 'PENDING', paidAt: null, sortOrder: 1 }],
        statusOf: new Map([[1, PROJECT_STATUS.ON_TRACK]]),
        now,
      });
      expect(out.installments[0].bucket).toBe(bucket);
      expect(out.cashflow[bucket].count).toBe(1);
    });
  }

  it('ไม่มี dueDate → noDate, overdueDays null', () => {
    const i = r.installments.find((x) => x.id === 14);
    expect(i.bucket).toBe('noDate');
    expect(i.overdueDays).toBeNull();
  });

  it('overdueDays นับจากขอบวันกรุงเทพ', () => {
    expect(r.installments.find((x) => x.id === 12).overdueDays).toBe(1);
  });
});

describe('computeFinance — ยังไม่ตั้งงวด / ตั้งงวดเกิน', () => {
  it('ตัวติดลบไม่กลบยอดที่ยังไม่ได้ตั้งงวดของโครงการอื่น', () => {
    // Alpha ขาด 200k · Beta เกิน 200k — ถ้าหักกลบจะได้ 0 ซึ่งผิด
    expect(r.totals.unplanned).toBe(200_000);
    expect(r.totals.overPlanned).toBe(200_000);
    expect(r.totals.overPlannedCount).toBe(1);
  });

  it('แยกรายโครงการ', () => {
    const alpha = r.projects.find((p) => p.code === 'PRJ_ALPHA');
    const beta = r.projects.find((p) => p.code === 'PRJ_BETA');
    expect([alpha.unplanned, alpha.overPlanned]).toEqual([200_000, 0]);
    expect([beta.unplanned, beta.overPlanned]).toEqual([0, 200_000]);
  });

  it('budget null ถูกนับแยก ไม่ปนกับโครงการ ฿0', () => {
    expect(r.totals.noBudgetCount).toBe(1);
    expect(r.projects.find((p) => p.code === 'PRJ_GAMMA').burnPct).toBeNull();
  });
});

describe('computeFinance — รูปร่างข้อมูล', () => {
  it('เรียงตาม sortOrder ในแต่ละโครงการ', () => {
    expect(byCode('PRJ_ALPHA').map((i) => i.id)).toEqual([11, 12, 13, 14]);
  });

  it('ไม่หลุด projectId ออกไปฝั่ง client', () => {
    for (const i of r.installments) expect(i).not.toHaveProperty('projectId');
  });

  it('ไม่มีงวดเลย → ยอดเป็น 0 ไม่ใช่ NaN', () => {
    const out = computeFinance({ projects, installments: [], statusOf, now });
    expect(out.totals.billed).toBe(0);
    expect(out.totals.outstanding).toBe(0);
    expect(out.totals.unplanned).toBe(1_500_000);
    expect(out.installments).toEqual([]);
  });
});
