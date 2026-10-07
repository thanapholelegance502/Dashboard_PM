import { describe, it, expect } from 'vitest';
import { parseSheetDate, parseThb, parsePercent, parseText } from '../src/domain/yokParse.js';
import { normalizeStage, stageIndex, YOK_STAGES } from '../src/domain/yokStage.js';
import { normalizeHealth, YOK_HEALTH } from '../src/domain/yokHealth.js';

describe('parseSheetDate', () => {
  it('serial number → วันที่ตามโซนกรุงเทพ', () => {
    // 45931 = 2025-10-01 (Google serial, epoch 1899-12-30)
    expect(parseSheetDate(45931)).toBe('2025-10-01');
    expect(parseSheetDate(1)).toBe('1899-12-31');
  });

  it('⚠️ DD/MM/YYYY อ่านแบบ day-first — 03/04/2026 = 3 เม.ย. ไม่ใช่ 3 มี.ค.', () => {
    expect(parseSheetDate('03/04/2026')).toBe('2026-04-03');
    expect(parseSheetDate('31/12/2026')).toBe('2026-12-31');
    expect(parseSheetDate('1.2.2026')).toBe('2026-02-01');
  });

  it('‼️ gviz "Date(y,m,d)" — เดือนนับจาก 0', () => {
    expect(parseSheetDate('Date(2026,8,28)')).toBe('2026-09-28');  // 8 = ก.ย.
    expect(parseSheetDate('Date(2026,0,1)')).toBe('2026-01-01');   // 0 = ม.ค.
    expect(parseSheetDate('Date(2026,11,31)')).toBe('2026-12-31'); // 11 = ธ.ค.
    expect(parseSheetDate('Date(2026,8,28,0,0,0)')).toBe('2026-09-28');
    expect(parseSheetDate('Date(2026,12,1)')).toBeNull();          // เดือน 12 ไม่มีจริง
  });

  it('ISO ผ่านตรง ๆ', () => {
    expect(parseSheetDate('2026-09-28')).toBe('2026-09-28');
    expect(parseSheetDate('2026-09-28T11:00:00Z')).toBe('2026-09-28');
  });

  it('ปี พ.ศ. → ค.ศ.', () => {
    expect(parseSheetDate('03/04/2569')).toBe('2026-04-03');
    expect(parseSheetDate('3 ก.ย. 2569')).toBe('2026-09-03');
  });

  it('ชื่อเดือนไทย/อังกฤษ', () => {
    expect(parseSheetDate('3 Sep 2026')).toBe('2026-09-03');
    expect(parseSheetDate('15 ธ.ค. 2026')).toBe('2026-12-15');
  });

  it('อ่านไม่ออก → null ไม่ใช่ Invalid Date และไม่ default เป็นวันนี้', () => {
    for (const bad of ['', null, undefined, 'TBD', 'ยังไม่กำหนด', '31/02/2026', 'abc', 0, -5]) {
      expect(parseSheetDate(bad), String(bad)).toBeNull();
    }
  });
});

describe('parseThb', () => {
  it('ตัวเลขผ่านตรง ๆ', () => {
    expect(parseThb(1234567)).toBe(1234567);
    expect(parseThb(0)).toBe(0);
  });
  it('ข้อความที่มีสัญลักษณ์เงิน', () => {
    expect(parseThb('฿1,234,567')).toBe(1234567);
    expect(parseThb('1,234,567.00')).toBe(1234567);
    expect(parseThb('1234567 บาท')).toBe(1234567);
    expect(parseThb('THB 500')).toBe(500);
  });
  it('วงเล็บ = ติดลบ', () => {
    expect(parseThb('(5,000)')).toBe(-5000);
    expect(parseThb('-5000')).toBe(-5000);
  });
  it('ค่าว่าง → null ไม่ใช่ 0 · ขยะ → null ไม่ใช่ NaN', () => {
    for (const v of ['', null, undefined, '-', 'N/A', 'TBD', 'abc', '1.2.3']) {
      const r = parseThb(v);
      expect(r, String(v)).toBeNull();
      expect(Number.isNaN(r)).toBe(false);
    }
  });
});

describe('parsePercent', () => {
  it('สามรูปแบบที่เจอได้', () => {
    expect(parsePercent(0.75)).toBe(75);
    expect(parsePercent('75%')).toBe(75);
    expect(parsePercent(75)).toBe(75);
  });
  it('ขอบ 0 กับ 1', () => {
    expect(parsePercent(0)).toBe(0);
    expect(parsePercent(1)).toBe(100);
    expect(parsePercent('100%')).toBe(100);
  });
  it('เกินช่วง → clamp · อ่านไม่ออก → null', () => {
    expect(parsePercent(150)).toBe(100);
    expect(parsePercent(-5)).toBe(0);
    expect(parsePercent('')).toBeNull();
    expect(parsePercent('abc')).toBeNull();
  });
});

describe('parseText', () => {
  it('trim · ว่าง → null', () => {
    expect(parseText('  LKN  ')).toBe('LKN');
    expect(parseText('')).toBeNull();
    expect(parseText(null)).toBeNull();
  });
});

describe('normalizeStage', () => {
  it('13 ขั้นเรียงถูก · index ไล่ขึ้น', () => {
    expect(YOK_STAGES).toHaveLength(13);
    YOK_STAGES.forEach((s, i) => expect(stageIndex(s)).toBe(i));
    expect(stageIndex('Sales process')).toBeLessThan(stageIndex('PROD'));
  });

  it('ไม่สน case / เว้นวรรค / ขีด', () => {
    for (const v of ['PM - Planning', 'PM-Planning', 'pm planning', 'PM   Planning']) {
      expect(normalizeStage(v).index, v).toBe(2);
    }
    expect(normalizeStage('requirement and analysis').index).toBeNull(); // 'and' != '&' — ต้องไม่เดามั่ว
    expect(normalizeStage('Requirement & Analysis').index).toBe(3);
  });

  it('stage ไม่รู้จัก → เก็บ label ไว้ + ติดธง ไม่ทิ้งแถว', () => {
    const r = normalizeStage('Pre-sales Workshop');
    expect(r.unknown).toBe(true);
    expect(r.label).toBe('Pre-sales Workshop');
    expect(r.index).toBeNull();
  });

  it('ว่าง → ไม่ใช่ unknown (ไม่มีข้อมูล ≠ ข้อมูลผิด)', () => {
    expect(normalizeStage('')).toEqual({ code: null, label: null, index: null, unknown: false });
  });
});

describe('normalizeHealth', () => {
  it('ค่าหลวม ๆ ของหยกครบทุกตัว', () => {
    expect(normalizeHealth('Not Start')).toBe(YOK_HEALTH.NOT_START);
    expect(normalizeHealth('notstart')).toBe(YOK_HEALTH.NOT_START);
    expect(normalizeHealth('Completed')).toBe(YOK_HEALTH.COMPLETED);
    expect(normalizeHealth('done')).toBe(YOK_HEALTH.COMPLETED);
    expect(normalizeHealth('Delayed')).toBe(YOK_HEALTH.DELAYED);
    expect(normalizeHealth('late')).toBe(YOK_HEALTH.DELAYED);
    expect(normalizeHealth('At Risk')).toBe(YOK_HEALTH.AT_RISK);
    expect(normalizeHealth('Blocked')).toBe(YOK_HEALTH.BLOCKED);
    expect(normalizeHealth('On Track')).toBe(YOK_HEALTH.ON_TRACK);
  });

  it('BLOCKED ไม่ถูก risk กลืน · NOT_START ไม่ถูก ontrack กลืน', () => {
    expect(normalizeHealth('Blocked - at risk')).toBe(YOK_HEALTH.BLOCKED);
    expect(normalizeHealth('Not Started / on track')).toBe(YOK_HEALTH.NOT_START);
  });

  it('‼️ ว่าง/ไม่รู้จัก → null ไม่ใช่ NOT_START', () => {
    expect(normalizeHealth('')).toBeNull();
    expect(normalizeHealth(null)).toBeNull();
    expect(normalizeHealth('   ')).toBeNull();
    expect(normalizeHealth('ยังไม่ระบุ')).toBeNull();
  });
});
