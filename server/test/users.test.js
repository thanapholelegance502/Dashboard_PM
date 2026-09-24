// จัดการ AppUser — กันข้อมูลผิด + กัน admin ล็อกตัวเองออก (MASTER §7)
import { describe, it, expect } from 'vitest';
import { normalizeNewUser, assertUserChangeAllowed, loginEmailCandidates } from '../src/domain/users.js';

const statusOf = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e.status;
  }
};

describe('normalizeNewUser', () => {
  it('trim + lowercase email, role default VIEWER, displayName จากหน้า @', () => {
    expect(normalizeNewUser({ email: '  Somchai@Example.COM ' })).toEqual({
      email: 'somchai@example.com', displayName: 'somchai', role: 'VIEWER', isActive: true,
    });
  });
  it('รับ role ตัวเล็ก + displayName ที่ส่งมา', () => {
    expect(normalizeNewUser({ email: 'a@b.co', role: 'pm', displayName: ' A ' })).toMatchObject({ role: 'PM', displayName: 'A' });
  });
  it('email ผิดรูป → 400', () => {
    expect(statusOf(() => normalizeNewUser({ email: 'not-an-email' }))).toBe(400);
    expect(statusOf(() => normalizeNewUser({}))).toBe(400);
  });
  it('role แปลก → 400', () => {
    expect(statusOf(() => normalizeNewUser({ email: 'a@b.co', role: 'OWNER' }))).toBe(400);
  });
});

describe('assertUserChangeAllowed', () => {
  const admin1 = { id: 1, role: 'ADMIN', isActive: true };
  const admin2 = { id: 2, role: 'ADMIN', isActive: true };
  const viewer = { id: 3, role: 'VIEWER', isActive: true };
  const check = (target, change, activeAdminCount = 1, actorId = 1) =>
    statusOf(() => assertUserChangeAllowed({ actorId, target, change, activeAdminCount }));

  it('แก้ role ตัวเอง → 409', () => {
    expect(check(admin1, { role: 'PM' }, 2)).toBe(409);
  });
  it('ปิดใช้งานตัวเอง → 409', () => {
    expect(check(admin1, { isActive: false }, 2)).toBe(409);
  });
  it('แก้ชื่อตัวเองได้', () => {
    expect(check(admin1, { displayName: 'ข้าว' }, 1)).toBeNull();
  });
  it('ลด ADMIN คนสุดท้าย → 409', () => {
    expect(check(admin2, { role: 'PM' }, 1)).toBe(409);
  });
  it('ปิด ADMIN คนสุดท้าย → 409', () => {
    expect(check(admin2, { isActive: false }, 1)).toBe(409);
  });
  it('ลด ADMIN เมื่อมี ADMIN 2 คน → ผ่าน', () => {
    expect(check(admin2, { role: 'PM' }, 2)).toBeNull();
  });
  it('แก้ / ปิด VIEWER → ผ่าน', () => {
    expect(check(viewer, { role: 'PM' })).toBeNull();
    expect(check(viewer, { isActive: false })).toBeNull();
  });
  it('role ไม่รู้จัก → 400', () => {
    expect(check(viewer, { role: 'OWNER' })).toBe(400);
  });
});

describe('loginEmailCandidates — อีเมลที่ใช้หา whitelist ตอน login', () => {
  it('มีทั้งอีเมลส่วนตัว + อีเมลบริษัท → ได้ทั้งคู่ (เดิมใช้แค่ email → คนใน whitelist โดน 403)', () => {
    expect(loginEmailCandidates({ email: 'someone@gmail.com', enterprise_email: 'staff@elegance.co.th' }))
      .toEqual(['staff@elegance.co.th', 'someone@gmail.com']);
  });
  it('ตัวพิมพ์ใหญ่/ช่องว่าง → ตัวพิมพ์เล็ก (whitelist เก็บตัวเล็ก)', () => {
    expect(loginEmailCandidates({ email: ' Staff@Elegance.co.th ' })).toEqual(['staff@elegance.co.th']);
  });
  it('ซ้ำกัน → เหลืออันเดียว · ไม่มีอีเมล → []', () => {
    expect(loginEmailCandidates({ email: 'a@b.co', enterprise_email: 'A@B.co' })).toEqual(['a@b.co']);
    expect(loginEmailCandidates({ email: '', enterprise_email: null })).toEqual([]);
    expect(loginEmailCandidates(undefined)).toEqual([]);
  });
});
