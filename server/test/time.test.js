import { describe, it, expect } from 'vitest';
import { isOverdue, todayDateStrBkk } from '../src/domain/time.js';
import { computeKpi } from '../src/domain/progress.js';

describe('overdue (Asia/Bangkok, DATA-LAYER §6)', () => {
  // อ้างอิง: 2026-09-18 12:00 Bangkok = 2026-09-18T05:00:00Z
  const now = new Date('2026-09-18T05:00:00Z');

  it('due เมื่อวาน = overdue', () => {
    expect(isOverdue(new Date('2026-09-17T10:00:00Z'), now)).toBe(true);
  });

  it('due วันนี้ (หลังเที่ยงคืน Bangkok) = ยังไม่ overdue', () => {
    // 2026-09-18 08:00 Bangkok = 01:00Z → หลังเที่ยงคืนวันนี้ Bangkok
    expect(isOverdue(new Date('2026-09-18T01:00:00Z'), now)).toBe(false);
  });

  it('ไม่มี due = ไม่ overdue', () => {
    expect(isOverdue(null, now)).toBe(false);
  });

  it('todayDateStrBkk คืนวันตาม Bangkok', () => {
    // 2026-09-18T18:00Z = 2026-09-19 01:00 Bangkok → ต้องเป็นวันที่ 19
    expect(todayDateStrBkk(new Date('2026-09-18T18:00:00Z'))).toBe('2026-09-19');
  });

  it('overdue นับเฉพาะ bucket != DONE', () => {
    const tasks = [
      { bucketCode: 'IN_PROGRESS', dueAt: new Date('2026-09-01T00:00:00Z') }, // overdue
      { bucketCode: 'DONE', dueAt: new Date('2026-09-01T00:00:00Z') }, // done → ไม่นับ
    ];
    expect(computeKpi(tasks, now).overdue).toBe(1);
  });
});
