// สิทธิ์บอร์ดแผนก — กัน tester เห็นการเงิน / กันบันทึก code บอร์ดมั่ว
import { describe, it, expect } from 'vitest';
import { BOARDS, BOARD_GROUPS, BOARD_CODES, normalizeBoards, effectiveBoards, canAccessBoard } from '../src/domain/boards.js';

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

describe('ทะเบียนบอร์ด — กลุ่มเมนู (sidebar + หน้าแรก ใช้ชุดเดียวกัน)', () => {
  const keys = BOARD_GROUPS.map((g) => g.key);

  it('ทุกบอร์ดอยู่ในกลุ่มที่รู้จัก', () => {
    for (const b of BOARDS) expect(keys, b.code).toContain(b.group);
  });

  it('ลำดับในทะเบียนเรียงตามลำดับกลุ่ม (ไม่งั้นเมนูกับหน้าแรกโดดไปมา)', () => {
    const order = BOARDS.map((b) => keys.indexOf(b.group));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('ทุกกลุ่มมีบอร์ดอย่างน้อย 1 ตัว · code ไม่ซ้ำ', () => {
    for (const k of keys) expect(BOARDS.some((b) => b.group === k), k).toBe(true);
    expect(new Set(BOARDS.map((b) => b.code)).size).toBe(BOARDS.length);
  });

  it('สองบอร์ด Project Executive ใช้ชื่อเดียวกัน ต่างแค่วงเล็บ', () => {
    const names = BOARDS.filter((b) => b.group === 'project').map((b) => b.name);
    expect(names).toEqual(['Project Executive (KHAW)', 'Project Executive (YOK)']);
  });
});
