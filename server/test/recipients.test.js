// ‼️ อีเมล example.com เท่านั้น — repo public (docs/HANDOFF.md)
import { describe, it, expect } from 'vitest';
import { parseRecipients, resolveRecipients, maskEmail } from '../src/mail/recipients.js';
import { isoWeekBkk } from '../src/report/sendWeekly.js';

const prodEnv = {
  nodeEnv: 'production',
  authMode: 'lark_sso',
  weeklyReportEnabled: true,
  mailAllowedDomain: 'example.com',
  weeklyReportTo: 'a@example.com, B@example.com ,c@example.com',
};
const me = { id: 7, email: 'me@example.com' };

describe('parseRecipients', () => {
  it('ตัดช่องว่าง · ตัวเล็ก · ตัดซ้ำ', () => {
    expect(parseRecipients('a@example.com, A@EXAMPLE.com ;b@example.com', { allowedDomain: 'example.com' }).list)
      .toEqual(['a@example.com', 'b@example.com']);
  });
  it('ผิดโดเมน / ไม่ใช่อีเมล → อยู่ใน invalid ไม่ถูกส่ง', () => {
    const r = parseRecipients('a@example.com,x@gmail.com,not-an-email,a@example.com.evil.io', { allowedDomain: 'example.com' });
    expect(r.list).toEqual(['a@example.com']);
    expect(r.invalid).toEqual(['x@gmail.com', 'not-an-email', 'a@example.com.evil.io']);
  });
  it('เกินจำนวนสูงสุด → throw', () => {
    const many = Array.from({ length: 11 }, (_, i) => `u${i}@example.com`).join(',');
    expect(() => parseRecipients(many, { allowedDomain: 'example.com' })).toThrow();
  });
});

describe('resolveRecipients — ด่านกันส่งพลาด', () => {
  it('SCHEDULED บน production + เปิดสวิตช์ → ผู้รับจริง 3 คน', () => {
    expect(resolveRecipients({ kind: 'SCHEDULED', env: prodEnv })).toEqual(['a@example.com', 'b@example.com', 'c@example.com']);
  });
  it('‼️ SCHEDULED นอก production → throw (เครื่อง dev ส่งถึงผู้รับจริงไม่ได้)', () => {
    expect(() => resolveRecipients({ kind: 'SCHEDULED', env: { ...prodEnv, nodeEnv: 'development' } })).toThrow(/production/);
  });
  it('‼️ SCHEDULED ยังไม่เปิดสวิตช์ → throw', () => {
    expect(() => resolveRecipients({ kind: 'SCHEDULED', env: { ...prodEnv, weeklyReportEnabled: false } })).toThrow();
  });
  it('SCHEDULED มีอีเมลผิดโดเมนปนมา → throw ทั้งชุด ไม่ส่งแค่บางคนเงียบ ๆ', () => {
    expect(() => resolveRecipients({ kind: 'SCHEDULED', env: { ...prodEnv, weeklyReportTo: 'a@example.com,x@gmail.com' } })).toThrow();
  });
  it('‼️ TEST ส่งถึงคนกดเท่านั้น — ไม่มีทางได้ WEEKLY_REPORT_TO แม้ส่ง override มา', () => {
    expect(resolveRecipients({ kind: 'TEST', env: prodEnv, user: me, override: 'a@example.com' })).toEqual(['me@example.com']);
  });
  it('‼️ TEST ในโหมด AUTH_MODE=dev → throw (user ปลอม ส่งผิดคน)', () => {
    expect(() => resolveRecipients({ kind: 'TEST', env: { ...prodEnv, authMode: 'dev' }, user: me })).toThrow(/dev/);
  });
  it('TEST ผู้ใช้อยู่นอกโดเมน → throw', () => {
    expect(() => resolveRecipients({ kind: 'TEST', env: prodEnv, user: { email: 'me@gmail.com' } })).toThrow();
  });
  it('CLI_TO ส่งถึงคนเดียวที่ระบุ ไม่ปน WEEKLY_REPORT_TO', () => {
    expect(resolveRecipients({ kind: 'CLI_TO', env: { ...prodEnv, nodeEnv: 'development' }, override: 'me@example.com' })).toEqual(['me@example.com']);
    expect(() => resolveRecipients({ kind: 'CLI_TO', env: prodEnv, override: 'a@example.com,b@example.com' })).toThrow();
  });
  it('ไม่ตั้ง MAIL_ALLOWED_DOMAIN → throw ทุกประเภท', () => {
    for (const kind of ['SCHEDULED', 'TEST', 'CLI_TO']) {
      expect(() => resolveRecipients({ kind, env: { ...prodEnv, mailAllowedDomain: '' }, user: me, override: 'me@example.com' }), kind).toThrow();
    }
  });
  it('ประเภทไม่รู้จัก → throw', () => {
    expect(() => resolveRecipients({ kind: 'BCC_ALL', env: prodEnv })).toThrow();
  });
});

describe('อื่น ๆ', () => {
  it('maskEmail ปิดบังก่อนแสดงในหน้าตั้งค่า', () => expect(maskEmail('someone@example.com')).toBe('s***@example.com'));
  it('isoWeekBkk ตามวันกรุงเทพ (ศุกร์ 20 พ.ย. 69 = 2026-W47)', () => {
    expect(isoWeekBkk(new Date('2026-11-20T10:30:00Z'))).toBe('2026-W47');
    expect(isoWeekBkk(new Date('2026-11-22T17:30:00Z'))).toBe('2026-W48'); // จันทร์ 00:30 ไทย = สัปดาห์ใหม่
  });
});
