// callback แยก flow ถูก — กัน code ของ authorize ถูก SSO กินไปก่อน + กันเขียน token ETL จาก state ปลอม
import { describe, it, expect } from 'vitest';
import { newEtlState, classifyCallback } from '../src/domain/oauthState.js';

describe('newEtlState', () => {
  it('สุ่มใหม่ทุกครั้ง + ขึ้นต้น etl-', () => {
    const a = newEtlState();
    expect(a).toMatch(/^etl-[0-9a-f]{32}$/);
    expect(newEtlState()).not.toBe(a);
  });
});

describe('classifyCallback', () => {
  const s = 'etl-abc';
  it('ADMIN + state ตรงกับ session → etl', () => {
    expect(classifyCallback({ state: s, sessionState: s, isAdmin: true })).toBe('etl');
  });
  it('state etl แต่ไม่ตรง session / ไม่มีใน session → reject', () => {
    expect(classifyCallback({ state: s, sessionState: 'etl-other', isAdmin: true })).toBe('reject');
    expect(classifyCallback({ state: s, sessionState: undefined, isAdmin: true })).toBe('reject');
  });
  it('state ตรงแต่ไม่ใช่ ADMIN (ถูกลดสิทธิ์ระหว่างทาง) → reject', () => {
    expect(classifyCallback({ state: s, sessionState: s, isAdmin: false })).toBe('reject');
  });
  it('state setup- จาก CLI → cli (ไม่แตะ code)', () => {
    expect(classifyCallback({ state: 'setup-1790221550517', sessionState: undefined, isAdmin: false })).toBe('cli');
  });
  it('login / ไม่มี state → login (SSO เดิม)', () => {
    expect(classifyCallback({ state: 'login', isAdmin: false })).toBe('login');
    expect(classifyCallback({ state: undefined })).toBe('login');
    expect(classifyCallback({ state: ['x'] })).toBe('login');
  });
});
