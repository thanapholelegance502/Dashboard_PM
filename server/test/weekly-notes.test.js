// โน้ตรายสัปดาห์ — ทดสอบส่วน pure (normalize/pick) · ส่วนที่แตะ DB อยู่ใน pm-api (ต้องมี DB · ไม่อยู่ใน ci)
import { describe, it, expect } from 'vitest';
import { normalizeNote, pickNote, emptyNote } from '../src/services/weeklyNotes.js';
import { isoWeekBkk } from '../src/report/thaiFormat.js';

describe('normalizeNote — กันค่าจาก client', () => {
  it('3 ช่องครบ · ค่าที่ขาดเป็นสตริงว่าง', () => {
    expect(normalizeNote({ summary: 'a' })).toEqual({ summary: 'a', issues: '', outOfScope: '' });
    expect(normalizeNote()).toEqual(emptyNote());
  });
  it('แปลง CRLF เป็น LF · ตัดความยาวเกิน 5000', () => {
    expect(normalizeNote({ summary: 'x\r\ny' }).summary).toBe('x\ny');
    expect(normalizeNote({ issues: 'ก'.repeat(6000) }).issues.length).toBe(5000);
  });
  it('ค่าที่ไม่ใช่สตริง → แปลงเป็นสตริง (ไม่พัง)', () => {
    expect(normalizeNote({ summary: 123, issues: null, outOfScope: undefined })).toEqual({ summary: '123', issues: '', outOfScope: '' });
  });
});

describe('pickNote — คัดเฉพาะ 3 ช่อง', () => {
  it('null → 3 ช่องว่าง', () => expect(pickNote(null)).toEqual(emptyNote()));
  it('ตัด field อื่นทิ้ง (updatedBy ฯลฯ)', () => {
    expect(pickNote({ summary: 's', issues: 'i', outOfScope: 'o', updatedBy: 9, weekKey: 'x' }))
      .toEqual({ summary: 's', issues: 'i', outOfScope: 'o' });
  });
});

describe('weekKey = isoWeekBkk (id ของโน้ต/archive)', () => {
  it('ศุกร์ 20 พ.ย. 69 = 2026-W47 · จันทร์ถัดไปขึ้นสัปดาห์ใหม่', () => {
    expect(isoWeekBkk(new Date('2026-11-20T10:30:00Z'))).toBe('2026-W47');
    expect(isoWeekBkk(new Date('2026-11-22T17:30:00Z'))).toBe('2026-W48'); // จันทร์ 00:30 ไทย
  });
});
