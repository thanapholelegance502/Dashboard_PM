// สิทธิ์บอร์ดแผนก — กัน tester เห็นการเงิน / กันบันทึก code บอร์ดมั่ว
import { describe, it, expect } from 'vitest';
import { BOARD_CODES, normalizeBoards, effectiveBoards, canAccessBoard } from '../src/domain/boards.js';

const statusOf = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e.status;
  }
};

describe('normalizeBoards', () => {
  it('ตัวเล็ก → ตัวใหญ่ · ตัดซ้ำ · เรียงตามทะเบียน', () => {
    expect(normalizeBoards(['qa', 'PM', 'QA'])).toEqual(['PM', 'QA']);
  });
  it('รายการว่าง = ไม่มีสิทธิ์บอร์ดใด', () => {
    expect(normalizeBoards([])).toEqual([]);
  });
  it('code ไม่รู้จัก / บอร์ดเร็ว ๆ นี้ → 400', () => {
    expect(statusOf(() => normalizeBoards(['HR']))).toBe(400);
    expect(statusOf(() => normalizeBoards(['UX']))).toBe(400);
  });
  it('ไม่ใช่ array → 400', () => {
    expect(statusOf(() => normalizeBoards('PM'))).toBe(400);
  });
});

describe('effectiveBoards / canAccessBoard', () => {
  const admin = { role: 'ADMIN', isActive: true, boards: [] };
  const tester = { role: 'VIEWER', isActive: true, boards: ['QA'] };

  it('ADMIN เห็นทุกบอร์ดที่เปิดใช้ แม้ boards ว่าง', () => {
    expect(effectiveBoards(admin)).toEqual(BOARD_CODES);
  });
  it('tester ที่มีแค่ QA เข้า PM / การเงินไม่ได้', () => {
    expect(canAccessBoard(tester, 'QA')).toBe(true);
    expect(canAccessBoard(tester, 'qa')).toBe(true);
    expect(canAccessBoard(tester, 'PM')).toBe(false);
    expect(canAccessBoard(tester, 'CLEVEL')).toBe(false);
  });
  it('ถูกปิดใช้งาน / ไม่มี user = ไม่มีบอร์ด', () => {
    expect(effectiveBoards({ ...admin, isActive: false })).toEqual([]);
    expect(effectiveBoards(null)).toEqual([]);
  });
  it('code ที่เก็บใน DB แต่เลิกใช้แล้ว ไม่หลุดออกไป', () => {
    expect(effectiveBoards({ role: 'PM', isActive: true, boards: ['PM', 'OLD'] })).toEqual(['PM']);
  });
});
