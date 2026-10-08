// ‼️ fixture ชื่อสมมติเท่านั้น — ชีตจริงมีชื่อลูกค้าจริง ห้ามหลุดเข้าโค้ด/เทส (MASTER §12.5)
// โครงสร้าง fixture ตรงกับชีตจริงที่สำรวจแล้ว:
//   Weekly_Update   = 1 แถวต่อสัปดาห์ (ไม่มี Project ID)
//   Project_Billing = 1 แถวต่อโครงการ · ชีตคำนวณเก็บแล้ว/ค้างเก็บมาให้
//   Billing_Schedule = ตารางที่ 2 ในแท็บเดียวกัน · 1 แถวต่องวด
//   Pending_Kickoff = ดีลที่ยังไม่เปิดโครงการ (ไม่มี Project ID)
//   Config!J        = ทะเบียนโครงการจริง
import { describe, it, expect } from 'vitest';
import { computeYokBoard } from '../src/domain/yokBoard.js';

const now = new Date('2026-09-28T11:00:00Z'); // 18:00 กรุงเทพ
const gidOf = new Map([
  ['Weekly_Update', 11], ['Milestone', 12], ['Executive_Action', 13],
  ['Pending_Kickoff', 14], ['Project_Billing', 15], ['MA_Tracking', 16],
]);
const R = { missingOptional: [], unknownHeaders: [] };
const sumBy = (a, k) => a.reduce((x, b) => x + (b[k] ?? 0), 0);

const tabs = {
  Config: {
    resolved: R,
    items: [
      { _row: 3, projectTab: 'PRJ_ALPHA' }, { _row: 4, projectTab: 'PRJ_BETA' },
      { _row: 5, projectTab: 'PRJ_GAMMA' }, { _row: 6, projectTab: 'PRJ_ZETA' },
    ],
  },
  Weekly_Update: {
    resolved: R,
    items: [
      { _row: 4, weekStart: '2026-09-21', summary: 'สัปดาห์นี้ปกติ' },
      { _row: 5, weekStart: '2026-09-14', summary: 'สัปดาห์ก่อน' },
    ],
  },
  Executive_Action: {
    resolved: R,
    items: [
      { _row: 2, projectId: 'PRJ_ALPHA', topic: 'อนุมัติงบเพิ่ม', owner: 'ทีมบริหาร', neededBy: '2026-09-20', status: 'รอตัดสินใจ' },
      { _row: 3, projectId: 'PRJ_BETA', topic: 'เลือก vendor', owner: 'ทีมบริหาร', neededBy: '2026-10-15', status: 'อนุมัติแล้ว', decidedAt: '2026-09-25' },
    ],
  },
  Milestone: {
    resolved: R,
    items: [{ _row: 2, projectId: 'PRJ_ALPHA', projectName: 'Alpha', name: 'UAT', dueDate: '2026-10-05', status: 'กำลังดำเนินการ' }],
  },
  Project_Billing: {
    resolved: R,
    items: [
      { _row: 4, projectId: 'PRJ_ALPHA', projectName: 'Alpha', amountExVat: 1000000, amountIncVat: 1070000, installments: 2, billed: 1070000, outstanding: 0 },
      { _row: 5, projectId: 'PRJ_BETA', projectName: 'Beta', amountExVat: 500000, amountIncVat: 535000, installments: 2, billed: 267500, outstanding: 267500 },
      { _row: 6, projectId: 'PRJ_GAMMA', projectName: 'Gamma', amountExVat: '', amountIncVat: '', installments: 0, billed: 0, outstanding: 0 },
    ],
  },
  Billing_Schedule: {
    resolved: R,
    items: [
      { _row: 20, projectId: 'PRJ_ALPHA', installmentNo: 1, paid: 1, amountExVat: 500000, vat: 35000, amountIncVat: 535000, dueDate: '2026-08-01', paidDate: '2026-08-02' },
      { _row: 21, projectId: 'PRJ_ALPHA', installmentNo: 2, paid: 1, amountExVat: 500000, vat: 35000, amountIncVat: 535000, dueDate: '2026-09-01', paidDate: '2026-09-01' },
      { _row: 22, projectId: 'PRJ_BETA', installmentNo: 1, paid: 1, amountExVat: 250000, vat: 17500, amountIncVat: 267500, dueDate: '2026-08-15', paidDate: '2026-08-15' },
      { _row: 23, projectId: 'PRJ_BETA', installmentNo: 2, paid: 0, amountExVat: 250000, vat: 17500, amountIncVat: 267500, dueDate: '2026-09-01', paidDate: null },
    ],
  },
  MA_Tracking: {
    resolved: R,
    items: [
      { _row: 4, projectId: 'PRJ_ALPHA', projectName: 'Alpha', startDate: '2026-01-01', endDate: '2026-10-20', duration: '12 เดือน', maType: 'มีค่า MA', projectValue: 1000000, value: 120000, payStatus: 'ชำระแล้ว' },
      { _row: 5, projectId: 'PRJ_BETA', projectName: 'Beta', startDate: '2025-01-01', endDate: '2026-08-01', duration: '12 เดือน', maType: 'MA Free', projectValue: 500000, value: 0, payStatus: 'ฟรี' },
    ],
  },
  Pending_Kickoff: {
    resolved: R,
    items: [{ _row: 2, projectName: 'ดีลใหม่ A', client: 'LUKKHA_C', note: 'รอเซ็นสัญญา' }],
  },
};

const r = computeYokBoard({ tabs, gidOf, now });
const S = r.sections;

describe('computeYokBoard — invariant §12.2 (KPI กับ list มาจากชุดเดียวกัน)', () => {
  it('ยอดรวมการเงิน = ผลรวมของแถวที่อธิบายมัน', () => {
    const items = S.billing.items;
    expect(S.billing.totals.exVat).toBe(sumBy(items, 'amountExVat'));
    expect(S.billing.totals.incVat).toBe(sumBy(items, 'amountIncVat'));
    expect(S.billing.totals.billed).toBe(sumBy(items, 'billed'));
    expect(S.billing.totals.outstanding).toBe(sumBy(items, 'outstanding'));
  });

  it('‼️ ปิดวง: เก็บแล้ว + ค้างเก็บ = รวม VAT — invariant ตัวนี้จับการนับซ้ำสองตารางได้', () => {
    const t = S.billing.totals;
    expect(t.billed + t.outstanding).toBe(t.incVat);
  });

  it('‼️ ทุกงวด: ก่อน VAT + VAT = รวม VAT', () => {
    expect(S.billing.schedule.length).toBeGreaterThan(0);
    for (const x of S.billing.schedule) {
      expect(x.amountExVat + x.vat, `งวด ${x.projectId}#${x.installmentNo}`).toBe(x.amountIncVat);
    }
  });

  it('KPI บน overview ตรงกับ list ของแต่ละ section', () => {
    expect(S.overview.kpis.openActions).toBe(S.executiveAction.items.filter((a) => !a.done).length);
    expect(S.overview.kpis.openActions).toBe(S.executiveAction.openCount);
    expect(S.overview.kpis.outstandingProjects).toBe(S.billing.items.filter((b) => (b.outstanding ?? 0) > 0).length);
    expect(S.overview.kpis.overdueInstallments).toBe(S.billing.schedule.filter((x) => x.overdueDays != null).length);
    expect(S.overview.kpis.maExpiring).toBe(S.maTracking.expiringCount);
    expect(S.overview.kpis.projects).toBe(S.projects.items.length);
  });

  it('ยอดเลยกำหนด = ผลรวมของงวดที่เลยกำหนดจริง', () => {
    const overdue = S.billing.schedule.filter((x) => x.overdueDays != null);
    expect(S.billing.overdueAmount).toBe(sumBy(overdue, 'amountIncVat'));
  });
});

describe('computeYokBoard — การตีความข้อมูล', () => {
  it('ค่าว่าง = null ไม่ใช่ 0 + มี warning', () => {
    const gamma = S.billing.items.find((b) => b.projectId === 'PRJ_GAMMA');
    expect(gamma.amountIncVat).toBeNull();
    expect(gamma.amountExVat).toBeNull();
    expect(r.warnings.find((w) => w.kind === 'missingAmount')).toMatchObject({ tab: 'Project_Billing', count: 1 });
  });

  it('ค้างเก็บ 0 = จ่ายครบ', () => {
    expect(S.billing.items.find((b) => b.projectId === 'PRJ_ALPHA').fullyPaid).toBe(true);
    expect(S.billing.items.find((b) => b.projectId === 'PRJ_BETA').fullyPaid).toBe(false);
  });

  it('งวดเลยกำหนดนับจากวันจริง · จ่ายแล้วไม่นับ', () => {
    const byRow = Object.fromEntries(S.billing.schedule.map((x) => [x.rowRef.row, x]));
    expect(byRow[23].overdueDays).toBe(27); // 2026-09-01 → 2026-09-28 ยังไม่จ่าย
    expect(byRow[21].overdueDays).toBeNull(); // จ่ายแล้ว
  });

  it('สถานะไทย "อนุมัติแล้ว" = ปิดเรื่องแล้ว', () => {
    expect(S.executiveAction.openCount).toBe(1);
    expect(S.executiveAction.items.find((a) => a.projectId === 'PRJ_BETA').done).toBe(true);
  });

  it('MA ใกล้หมดอายุ/หมดแล้ว แยกกัน', () => {
    expect(S.maTracking.expiringCount).toBe(1); // 2026-10-20 เหลือ 22 วัน
    expect(S.maTracking.expiredCount).toBe(1);  // 2026-08-01 หมดแล้ว
  });

  it('Weekly Update เป็นระดับ portfolio เรียงใหม่สุดก่อน ไม่มี projectId', () => {
    expect(S.weeklyUpdate.items.map((w) => w.weekStart)).toEqual(['2026-09-21', '2026-09-14']);
    expect(S.weeklyUpdate.items[0]).not.toHaveProperty('projectId');
  });
});

describe('computeYokBoard — ความถูกต้องของโครงสร้าง', () => {
  it('‼️ ทุกแถวทุก section มี rowRef ชี้กลับไปที่ชีต (§12.1)', () => {
    const all = [
      ...S.weeklyUpdate.items, ...S.executiveAction.items, ...S.billing.items, ...S.billing.schedule,
      ...S.maTracking.items, ...S.projects.milestones, ...S.projects.pendingKickoff,
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const it of all) {
      expect(it.rowRef, JSON.stringify(it)).toBeTruthy();
      expect(typeof it.rowRef.row).toBe('number');
      expect(it.rowRef.tab).toBeTruthy();
    }
  });

  it('ทะเบียนโครงการมาจาก Config!J — รวมตัวที่ยังไม่มีข้อมูลในแท็บอื่น', () => {
    const ids = S.projects.items.map((p) => p.projectId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('PRJ_ZETA'); // มีแค่ใน Config
    expect(S.overview.kpis.projects).toBe(4);
  });

  it('Pending Kickoff แยกลิสต์ ไม่มี Project ID', () => {
    expect(S.projects.pendingKickoff).toHaveLength(1);
    expect(S.projects.pendingKickoff[0]).not.toHaveProperty('projectId');
  });

  it('byStage มีครบ 13 ขั้นเสมอ (ลำดับคงที่)', () => {
    expect(S.overview.byStage).toHaveLength(13);
    expect(S.overview.byStage[0].key).toBe('Sales process');
    expect(S.overview.byStage[12].key).toBe('PROD');
  });

  it('ยังไม่ได้อ่านแท็บรายโครงการ → ติดธงไว้ ไม่แกล้งว่ามีข้อมูล', () => {
    expect(S.overview.projectsIncomplete).toBe(true);
    expect(r.warnings.find((w) => w.kind === 'projectDetailPending')).toBeTruthy();
  });

  it('ชีตว่างทั้งหมด → ทุกอย่างเป็น 0/[] ไม่ระเบิด', () => {
    const empty = computeYokBoard({ tabs: {}, gidOf, now });
    expect(empty.sections.overview.kpis.projects).toBe(0);
    expect(empty.sections.billing.totals.incVat).toBe(0);
    expect(empty.sections.billing.schedule).toEqual([]);
  });
});
