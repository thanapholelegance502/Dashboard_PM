import { describe, it, expect } from 'vitest';
import { resolveEffectiveProgress, isOverrideActive } from '../src/domain/progress.js';

const now = new Date('2026-09-18T05:00:00Z');
const day = 24 * 60 * 60 * 1000;

describe('override 14 วัน (02-PM §4)', () => {
  it('isOverrideActive: 2 วัน = สด, 20 วัน = หมดอายุ', () => {
    expect(isOverrideActive(new Date(now.getTime() - 2 * day), now)).toBe(true);
    expect(isOverrideActive(new Date(now.getTime() - 20 * day), now)).toBe(false);
    expect(isOverrideActive(null, now)).toBe(false);
  });

  it('override สด → ใช้ค่า override', () => {
    const p = { progressOverride: 80, progressOverrideAt: new Date(now.getTime() - 3 * day) };
    const r = resolveEffectiveProgress(p, 54, now);
    expect(r).toMatchObject({ value: 80, source: 'OVERRIDE', computed: 54, overrideExpired: false });
  });

  it('override หมดอายุ → ค่าคำนวณ + flag expired', () => {
    const p = { progressOverride: 80, progressOverrideAt: new Date(now.getTime() - 15 * day) };
    const r = resolveEffectiveProgress(p, 54, now);
    expect(r).toMatchObject({ value: 54, source: 'AUTO', overrideExpired: true });
  });

  it('ไม่มี override → ค่าคำนวณ', () => {
    const r = resolveEffectiveProgress({ progressOverride: null }, 54, now);
    expect(r).toMatchObject({ value: 54, source: 'AUTO', overrideExpired: false });
  });
});
