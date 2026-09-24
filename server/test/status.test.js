import { describe, it, expect } from 'vitest';
import { computeAutoStatus } from '../src/domain/status.js';

const now = new Date('2026-09-18T05:00:00Z');
const day = 24 * 60 * 60 * 1000;
const base = { openCount: 40, doneCount: 10, blockedCount: 0, overdueCount: 0, progressPct: 60 };

describe('computeAutoStatus (02-PM §5.1)', () => {
  it('DONE เมื่อมี actualGolive', () => {
    const r = computeAutoStatus({ actualGolive: now }, base, now);
    expect(r.status).toBe('DONE');
  });

  it('forecast ไม่มีผลแล้ว (ตัดออก 24 ก.ย.) — ยังไม่ถึง target = ไม่ DELAYED', () => {
    const r = computeAutoStatus(
      { targetGolive: new Date(now.getTime() + 30 * day), forecastGolive: new Date(now.getTime() + 60 * day) },
      base, now
    );
    expect(r.status).toBe('ON_TRACK');
  });

  it('DELAYED เมื่อเลย target แล้ว + บอกจำนวนวัน', () => {
    const r = computeAutoStatus({ targetGolive: new Date(now.getTime() - 3 * day) }, base, now);
    expect(r.status).toBe('DELAYED');
    expect(r.reasons[0]).toContain('3 วัน');
  });

  it('ไม่คืน WAITING เอง (PM ตั้งผ่าน override เท่านั้น)', () => {
    const r = computeAutoStatus({}, { ...base, doneCount: 0, progressPct: 0 }, now);
    expect(r.status).not.toBe('WAITING');
  });

  it('AT_RISK เมื่อมี blocker', () => {
    const r = computeAutoStatus({}, { ...base, blockedCount: 3 }, now);
    expect(r.status).toBe('AT_RISK');
    expect(r.reasons[0]).toContain('ติดปัญหา 3');
  });

  it('AT_RISK เมื่อ overdue > 10%', () => {
    const r = computeAutoStatus({}, { ...base, openCount: 40, overdueCount: 5 }, now);
    expect(r.status).toBe('AT_RISK');
    expect(r.reasons.some((x) => x.includes('เกินกำหนด'))).toBe(true);
  });

  it('AT_RISK เมื่อเหลือ ≤14 วันถึง target แต่ progress < 80', () => {
    const r = computeAutoStatus({ targetGolive: new Date(now.getTime() + 7 * day) }, { ...base, progressPct: 50 }, now);
    expect(r.status).toBe('AT_RISK');
    expect(r.reasons.some((x) => x.includes('เหลือ'))).toBe(true);
  });

  it('รวมหลายเหตุใน AT_RISK', () => {
    const r = computeAutoStatus({}, { ...base, blockedCount: 2, openCount: 40, overdueCount: 8 }, now);
    expect(r.status).toBe('AT_RISK');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it('ON_TRACK เมื่อไม่มีสัญญาณ', () => {
    const r = computeAutoStatus({ targetGolive: new Date(now.getTime() + 60 * day) }, base, now);
    expect(r.status).toBe('ON_TRACK');
  });
});
