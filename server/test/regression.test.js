// Regression AUS_SILVER (MASTER §10) — คำนวณ expected จาก weight ใน rule set ไม่ hardcode
import { describe, it, expect } from 'vitest';
import { transformTask } from '../src/etl/transform.js';
import { computeWeightedProgress, computeKpi } from '../src/domain/progress.js';
import { buildAusSilver, RULES } from './fixtures.js';

function transformAll() {
  const { tasks } = buildAusSilver();
  return tasks.map((raw) => transformTask(raw, { projectId: 1, rules: RULES }));
}

describe('regression AUS_SILVER', () => {
  const records = transformAll();

  it('total การ์ด = 132 (pagination ครบ)', () => {
    expect(records.length).toBe(132);
  });

  it('PM progress % = 54 (ถ่วงน้ำหนักตาม §5)', () => {
    // expected คำนวณจาก weight ใน RULES (ถ้า weight เปลี่ยน ค่านี้เปลี่ยนตาม — ไม่ hardcode 54)
    const sum = records.reduce((a, r) => a + r.sectionWeight, 0);
    const expected = Math.round(sum / records.length);
    expect(computeWeightedProgress(records)).toBe(expected);
    expect(expected).toBe(54); // ยืนยันตรงกับที่ข้าวนับด้วยตา
  });

  it('QA KPI: ค้าง 41 · เสร็จ 0 · Active 41 · blocker 0', () => {
    const qa = records.filter((r) => r.deptCode === 'QA');
    const kpi = computeKpi(qa);
    expect(kpi.open).toBe(41);
    expect(kpi.done).toBe(0);
    expect(kpi.active).toBe(41);
    expect(kpi.blocker).toBe(0);
  });

  it('KPI blocker กับ list blocker มาจาก query เดียวกัน (bucket=BLOCKED)', () => {
    const blockedList = records.filter((r) => r.bucketCode === 'BLOCKED');
    const kpi = computeKpi(records);
    expect(kpi.blocker).toBe(blockedList.length); // AUS_SILVER = 0
  });
});
