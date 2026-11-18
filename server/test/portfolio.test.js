// ‼️ fixture ชื่อสมมติ (MASTER §12.5)
import { describe, it, expect } from 'vitest';
import {
  sameBkkMonth, computePortfolioKpis, computeUpcomingMilestones, computeStatusBreakdown, toProjectRow, sortByPain,
} from '../src/domain/portfolio.js';

const now = new Date('2026-11-20T10:30:00Z'); // ศุกร์ 17:30 กรุงเทพ
const day = 24 * 60 * 60 * 1000;
const at = (d) => new Date(now.getTime() + d * day);

const row = (code, status, extra = {}) => ({
  project: { projectCode: code, displayName: code, targetUat: null, targetGolive: null, ...extra },
  metrics: { status },
});

describe('sameBkkMonth — ขอบเดือนตามเวลากรุงเทพ', () => {
  it('30 พ.ย. 23:30 ไทย (= 16:30 UTC) ยังเป็นเดือน พ.ย.', () => {
    expect(sameBkkMonth(new Date('2026-11-30T16:30:00Z'), now)).toBe(true);
  });
  it('1 ธ.ค. 00:30 ไทย (= 30 พ.ย. 17:30 UTC) เป็นเดือน ธ.ค. แล้ว', () => {
    expect(sameBkkMonth(new Date('2026-11-30T17:30:00Z'), now)).toBe(false);
  });
  it('null → false', () => expect(sameBkkMonth(null, now)).toBe(false));
});

describe('computePortfolioKpis — §12.2 KPI นับจากแถวชุดเดียวกัน', () => {
  const all = [
    row('PRJ_A', 'ON_TRACK', { targetUat: at(3) }),
    row('PRJ_B', 'AT_RISK', { targetGolive: at(5) }),
    row('PRJ_C', 'DELAYED'),
    row('PRJ_D', 'DELAYED'),
    row('PRJ_E', 'WAITING', { targetUat: at(60) }), // เดือนหน้า ไม่นับ
    row('PRJ_F', 'DONE'),
  ];
  const k = computePortfolioKpis(all, now);

  it('จำนวนต่อสถานะ = จำนวนแถวที่สถานะนั้นจริง', () => {
    expect(k.total).toBe(6);
    expect(k.onTrack).toBe(1);
    expect(k.atRisk).toBe(1);
    expect(k.delayed).toBe(2);
    expect(k.waiting).toBe(1);
  });
  it('UAT/Go-Live เดือนนี้ นับเฉพาะเดือนเดียวกัน', () => {
    expect(k.uatThisMonth).toBe(1);
    expect(k.goliveThisMonth).toBe(1);
  });
});

describe('computeUpcomingMilestones', () => {
  const projects = [
    { projectCode: 'PRJ_A', displayName: 'A', targetUat: at(10), actualUat: null, targetGolive: at(40), actualGolive: null },
    { projectCode: 'PRJ_B', displayName: 'B', targetUat: at(2), actualUat: at(1), targetGolive: at(5), actualGolive: null }, // UAT เกิดแล้ว
    { projectCode: 'PRJ_C', displayName: 'C', targetUat: at(-3), actualUat: null, targetGolive: null, actualGolive: null }, // เลยไปแล้ว
  ];

  it('ข้ามตัวที่มี actual แล้ว และตัวที่วันผ่านไปแล้ว · เรียงใกล้สุดก่อน', () => {
    const r = computeUpcomingMilestones(projects, now);
    expect(r.map((m) => `${m.code}:${m.type}`)).toEqual(['PRJ_B:GO_LIVE', 'PRJ_A:UAT', 'PRJ_A:GO_LIVE']);
    expect(r[0].inDays).toBe(5);
  });
  it('days จำกัดช่วง · limit ตัดจำนวน', () => {
    expect(computeUpcomingMilestones(projects, now, { days: 14 }).map((m) => m.code)).toEqual(['PRJ_B', 'PRJ_A']);
    expect(computeUpcomingMilestones(projects, now, { limit: 1 })).toHaveLength(1);
  });
});

describe('computeStatusBreakdown — ลำดับเดียวกับ donut บนจอ', () => {
  it('เรียง WAITING, ON_TRACK, AT_RISK, DELAYED, DONE · ตัดสถานะที่เป็น 0', () => {
    const rows = ['DELAYED', 'ON_TRACK', 'DELAYED', 'DONE'].map((status) => ({ status }));
    expect(computeStatusBreakdown(rows)).toEqual([
      { status: 'ON_TRACK', count: 1 },
      { status: 'DELAYED', count: 2 },
      { status: 'DONE', count: 1 },
    ]);
  });
  it('ไม่มีโครงการ → []', () => expect(computeStatusBreakdown([])).toEqual([]));
});

describe('toProjectRow — field ครบ ลำดับเดิม', () => {
  it('hasTargetGolive มาจาก targetGolive', () => {
    const r = toProjectRow({ projectCode: 'PRJ_A', targetGolive: null }, { status: 'ON_TRACK' });
    expect(r.code).toBe('PRJ_A');
    expect(r.hasTargetGolive).toBe(false);
    expect(Object.keys(r)[0]).toBe('code');
  });
});

describe('sortByPain — เรียงตามความเดือดร้อน (web + PDF ชุดเดียว)', () => {
  const r = (code, status, slipDays = null) => ({ code, status, slipDays });

  it('ลำดับสถานะ Delayed → At Risk → On Track → Waiting → Done', () => {
    const out = sortByPain([
      r('C', 'DONE'), r('W', 'WAITING'), r('O', 'ON_TRACK'), r('A', 'AT_RISK'), r('D', 'DELAYED'),
    ]).map((x) => x.code);
    expect(out).toEqual(['D', 'A', 'O', 'W', 'C']);
  });

  it('ในสถานะเดียวกัน slipDays มากก่อน · null ไปท้ายกลุ่ม', () => {
    const out = sortByPain([
      r('d5', 'DELAYED', 5), r('d20', 'DELAYED', 20), r('dNull', 'DELAYED', null), r('d12', 'DELAYED', 12),
    ]).map((x) => x.code);
    expect(out).toEqual(['d20', 'd12', 'd5', 'dNull']);
  });

  it('สถานะ+slip เท่ากัน → คงลำดับเดิมของ input (stable = sortOrder เดิม)', () => {
    const out = sortByPain([
      r('first', 'ON_TRACK'), r('second', 'ON_TRACK'), r('third', 'ON_TRACK'),
    ]).map((x) => x.code);
    expect(out).toEqual(['first', 'second', 'third']);
  });

  it('ไม่กลายพันธุ์ input เดิม', () => {
    const input = [r('a', 'DONE'), r('b', 'DELAYED', 3)];
    sortByPain(input);
    expect(input.map((x) => x.code)).toEqual(['a', 'b']);
  });
});
