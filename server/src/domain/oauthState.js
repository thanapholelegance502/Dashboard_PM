// แยกว่า /api/auth/callback ที่ Lark ส่งกลับมา เป็น flow ไหน (pure — test ได้)
//   etl   = ADMIN กดปุ่ม "เชื่อม Lark ใหม่" ในหน้าตั้งค่า → แลก code เป็น token ETL
//   cli   = มาจาก `npm run lark:authorize` (state ขึ้นต้น setup-) → ห้ามแตะ code ให้คนก็อบไปรัน --code
//   login = SSO ปกติ
//   reject = state ของ flow ETL แต่ไม่ตรงกับ session / ไม่ใช่ ADMIN → ห้ามเขียน token (กันคนยัดบัญชีตัวเองเป็น token ETL)
import crypto from 'node:crypto';

export const ETL_STATE_PREFIX = 'etl-';
export const CLI_STATE_PREFIX = 'setup-'; // ตรงกับ scripts/authorize.js

/** state สุ่มใหม่ต่อการกดปุ่มแต่ละครั้ง (เก็บใน session, ใช้ครั้งเดียว) */
export function newEtlState() {
  return `${ETL_STATE_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
}

/** @returns {'etl' | 'cli' | 'login' | 'reject'} */
export function classifyCallback({ state, sessionState, isAdmin }) {
  const s = typeof state === 'string' ? state : '';
  if (s.startsWith(ETL_STATE_PREFIX)) {
    return isAdmin && sessionState && s === sessionState ? 'etl' : 'reject';
  }
  if (s.startsWith(CLI_STATE_PREFIX)) return 'cli';
  return 'login';
}
