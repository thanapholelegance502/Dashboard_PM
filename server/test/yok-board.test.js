// ‼️ fixture ชื่อสมมติเท่านั้น (MASTER §12.5)
import { describe, it, expect } from 'vitest';
import { computeYokBoard } from '../src/domain/yokBoard.js';

const now = new Date('2026-09-28T11:00:00Z'); // 18:00 กรุงเทพ
const gidOf = new Map([
  ['Weekly_Update', 11], ['Milestone', 12], ['Executive_Action', 13],
  ['Pending_Kickoff', 14], ['Project_Billing', 15], ['MA_Tracking', 16],
]);

const tabs = {
  Weekly_Update: {
    resolved: { missingOptional: [], unknownHeaders: [] },
    items: [
      { _row: 2, projectId: 'PRJ_ALPHA', projectName: 'Alpha', week: 'W39', weekStart: '2026-09-21', summary: 'ปกติ', risk: null },
      { _row: 3, projectId: 'PRJ_BETA', projectName: 'Beta', week: 'W38', weekStart: '2026-09-14', summary: 'ช้า', risk: 'รอลูกค้า' },
    ],
  },
  Executive_Action: {
    resolved: { missingOptional: [], unknownHeaders: [] },
    items: [
      { _row: 2, projectId: 'PRJ_ALPHA', topic: 'อนุมัติงบเพิ่ม', owner: 'CEO', neededBy: '2026-09-20', status: null },
      { _row: 3, projectId: 'PRJ_BETA', topic: 'เลือก vendor', owner: 'CFO', neededBy: '2026-10-15', status: 'Done' },
    ],
  },
  Milestone: {
    resolved: { missingOptional: [], unknownHeaders: [] },
    items: [{ _row: 2, projectId: 'PRJ_ALPHA', name: 'UAT', dueDate: '2026-10-05', status: null }],
  },
  Project_Billing: {
    resolved: { missingOptional: [], unknownHeaders: [] },
    items: [
      { _row: 2, projectId: 'PRJ_ALPHA', installment: 'งวด 1', amount: '฿1,000,000', dueDate: '2026-08-01', status: 'Paid' },
      { _row: 3, projectId: 'PRJ_ALPHA', installment: 'งวด 2', amount: 500000, dueDate: '2026-09-01', status: 'Pending' },
      { _row: 4, projectId: 'PRJ_BETA', installment: 'งวด 1', amount: 300000, dueDate: '2026-12-01', status: null },
      { _row: 5, projectId: 'PRJ_GAMMA', installment: 'งวด 1', amount: '', dueDate: null, status: null },
    ],
  },
  MA_Tracking: {
    resolved: { missingOptional: [], unknownHeaders: [] },
    items: [
      { _row: 2, projectId: 'PRJ_ALPHA', client: 'LUKKHA_A', startDate: '2026-01-01', endDate: '2026-10-20', value: 120000 },
      { _row: 3, projectId: 'PRJ_BETA', client: 'LUKKHA_B', startDate: '2025-01-01', endDate: '2026-08-01', value: 90000 },
    ],
  },
  Pending_Kickoff: {
    resolved: { missingOptional: [], unknownHeaders: [] },
    items: [{ _row: 2, projectId: 'PRJ_DELTA', projectName: 'Delta', client: 'LUKKHA_C', value: 2000000, note: 'รอเซ็น' }],
  },
};

const r = computeYokBoard({ tabs, gidOf, now });
const S = r.sections;

describe('computeYokBoard — invariant §12.2 (KPI กับ list มาจากชุดเดียวกัน)', () => {
  it('ยอดเงินแต่ละก้อน = ผลรวมของรายการที่อธิบายมัน', () => {
    const items = S.billing.items;
    const paid = items.filter((b) => b.paid);
    const unpaid = items.filter((b) => !b.paid);
    const overdue = unpaid.filter((b) => b.overdueDays != null);
    const sum = (a) => a.reduce((x, b) => x + (b.amount ?? 0), 0);

    expect(S.billing.totals.billed).toBe(sum(paid));
    expect(S.billing.totals.outstanding).toBe(sum(unpaid));
    expect(S.billing.totals.overdue).toBe(sum(overdue));
    expect(S.billing.totals.planned).toBe(sum(items));
    expect(S.billing.counts.billed).toBe(paid.length);
    expect(S.billing.counts.overdue).toBe(overdue.length);
  });

  it('ปิดวง: เก็บแล้ว + ค้างเก็บ = ทั้งหมด', () => {
    expect(S.billing.totals.billed + S.billing.totals.outstanding).toBe(S.billing.totals.planned);
  });

  it('KPI บน overview ตรงกับ list ของแต่ละ section', () => {
    expect(S.overview.kpis.openActions).toBe(S.executiveAction.items.filter((a) => !a.done).length);
    expect(S.overview.kpis.openActions).toBe(S.executiveAction.openCount);
    expect(S.overview.kpis.overdueBilling).toBe(S.billing.counts.overdue);
    expect(S.overview.kpis.maExpiring).toBe(S.maTracking.expiringCount);
    expect(S.overview.kpis.projects).toBe(S.projects.items.length);
  });
});

describe('computeYokBoard — การตีความข้อมูล', () => {
  it('เงินเป็น text แปลงได้ · ช่องว่าง = null ไม่ใช่ 0 + มี warning', () => {
    const byRow = Object.fromEntries(S.billing.items.map((b) => [b.rowRef.row, b]));
    expect(byRow[2].amount).toBe(1000000);
    expect(byRow[5].amount).toBeNull();
    expect(r.warnings.find((w) => w.kind === 'missingAmount')).toMatchObject({ tab: 'Project_Billing', count: 1 });
  });

  it('สถานะจ่ายแล้วอ่านจากข้อความหลวม ๆ · ว่าง = ยังไม่จ่าย', () => {
    const byRow = Object.fromEntries(S.billing.items.map((b) => [b.rowRef.row, b]));
    expect(byRow[2].paid).toBe(true);
    expect(byRow[3].paid).toBe(false);
    expect(byRow[4].paid).toBe(false);
  });

  it('งวดเลยกำหนดนับจากวันจริง · ยังไม่ถึงกำหนดไม่นับ', () => {
    const byRow = Object.fromEntries(S.billing.items.map((b) => [b.rowRef.row, b]));
    expect(byRow[3].overdueDays).toBe(27); // 2026-09-01 → 2026-09-28
    expect(byRow[4].overdueDays).toBeNull(); // 2026-12-01 ยังไม่ถึง
    expect(byRow[2].overdueDays).toBeNull(); // จ่ายแล้ว
  });

  it('MA ใกล้หมดอายุ/หมดแล้ว แยกกัน', () => {
    expect(S.maTracking.expiringCount).toBe(1); // 2026-10-20 เหลือ 22 วัน
    expect(S.maTracking.expiredCount).toBe(1);  // 2026-08-01 หมดแล้ว
    expect(S.maTracking.items[0].endDate).toBe('2026-08-01'); // เรียงวันหมดอายุก่อน
  });

  it('Executive Action ที่ Done ไม่นับเป็น open', () => {
    expect(S.executiveAction.openCount).toBe(1);
    expect(S.executiveAction.items.find((a) => a.topic === 'เลือก vendor').done).toBe(true);
  });

  it('Weekly Update เรียงใหม่สุดขึ้นก่อน', () => {
    expect(S.weeklyUpdate.items.map((w) => w.week)).toEqual(['W39', 'W38']);
  });
});

describe('computeYokBoard — ความถูกต้องของโครงสร้าง', () => {
  it('‼️ ทุกแถวทุก section มี rowRef ชี้กลับไปที่ cell ในชีต (§12.1)', () => {
    const all = [
      ...S.weeklyUpdate.items, ...S.executiveAction.items, ...S.billing.items,
      ...S.maTracking.items, ...S.projects.milestones, ...S.projects.pendingKickoff,
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const it of all) {
      expect(it.rowRef, JSON.stringify(it)).toBeTruthy();
      expect(typeof it.rowRef.row).toBe('number');
      expect(it.rowRef.tab).toBeTruthy();
      expect(it.rowRef.gid).not.toBeUndefined();
    }
  });

  it('roster รวมโครงการจากทุกแท็บ ไม่ซ้ำ', () => {
    const ids = S.projects.items.map((p) => p.projectId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('PRJ_ALPHA');
    expect(ids).toContain('PRJ_GAMMA'); // มีแค่ใน billing
  });

  it('Pending Kickoff ไม่ถูกนับเป็นโครงการที่เดินอยู่ (แยกลิสต์เหมือนเว็บหยก)', () => {
    expect(S.projects.items.map((p) => p.projectId)).not.toContain('PRJ_DELTA');
    expect(S.projects.pendingKickoff.map((p) => p.projectId)).toEqual(['PRJ_DELTA']);
    expect(S.overview.kpis.projects).toBe(3);
  });

  it('ยังไม่ได้เชื่อมแท็บรายโครงการ → ติดธงไว้ ไม่แกล้งว่ามีข้อมูล', () => {
    expect(S.overview.projectsIncomplete).toBe(true);
    expect(S.overview.byHealth).toEqual([]);
    expect(r.warnings.find((w) => w.kind === 'projectDetailPending')).toBeTruthy();
  });

  it('byStage มีครบ 13 ขั้นเสมอ (ลำดับคงที่)', () => {
    expect(S.overview.byStage).toHaveLength(13);
    expect(S.overview.byStage[0].key).toBe('Sales process');
    expect(S.overview.byStage[12].key).toBe('PROD');
  });

  it('ชีตว่างทั้งหมด → ทุกอย่างเป็น 0/[] ไม่ระเบิด', () => {
    const empty = computeYokBoard({ tabs: {}, gidOf, now });
    expect(empty.sections.overview.kpis.projects).toBe(0);
    expect(empty.sections.billing.totals.planned).toBe(0);
    expect(empty.sections.weeklyUpdate.items).toEqual([]);
  });
});
