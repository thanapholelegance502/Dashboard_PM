// จัดการ AppUser (whitelist SSO — MASTER §7) · pure function ไม่แตะ DB เพื่อ test ได้
export const ROLES = ['ADMIN', 'PM', 'VIEWER'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/**
 * อีเมลจาก Lark ที่ใช้หา AppUser ตอน login — ทั้ง email (อาจเป็นอีเมลส่วนตัว) และ enterprise_email (อีเมลบริษัท)
 * ตัวพิมพ์เล็กเสมอ เพราะ whitelist เก็บเป็นตัวพิมพ์เล็ก (normalizeNewUser / seed:appusers)
 */
export function loginEmailCandidates(info) {
  const list = [info?.enterprise_email, info?.email]
    .filter((e) => typeof e === 'string' && e.trim())
    .map((e) => e.trim().toLowerCase());
  return [...new Set(list)];
}

/** ตรวจ + ทำความสะอาดข้อมูลผู้ใช้ใหม่ · ผิด → throw status 400 */
export function normalizeNewUser(body = {}) {
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw fail(400, 'อีเมลไม่ถูกต้อง');
  const role = String(body.role ?? 'VIEWER').toUpperCase();
  if (!ROLES.includes(role)) throw fail(400, `role ต้องเป็น ${ROLES.join(' / ')}`);
  const displayName = String(body.displayName ?? '').trim() || email.split('@')[0];
  return { email, displayName, role, isActive: true };
}

/**
 * กันแก้สิทธิ์แล้วระบบไม่มีคนดูแล · ผิด → throw status 409
 * @param {{ actorId:number, target:{id:number, role:string, isActive:boolean},
 *           change:{role?:string, isActive?:boolean}, activeAdminCount:number }} a
 */
export function assertUserChangeAllowed({ actorId, target, change, activeAdminCount }) {
  if (change.role !== undefined && !ROLES.includes(change.role)) {
    throw fail(400, `role ต้องเป็น ${ROLES.join(' / ')}`);
  }
  const roleChanged = change.role !== undefined && change.role !== target.role;
  const deactivating = change.isActive === false && target.isActive;

  if (target.id === actorId && (roleChanged || deactivating)) {
    throw fail(409, 'แก้ role หรือปิดใช้งานบัญชีตัวเองไม่ได้ — ให้ Admin คนอื่นทำ');
  }
  const losesAdmin = target.role === 'ADMIN' && target.isActive && (roleChanged || deactivating);
  if (losesAdmin && activeAdminCount <= 1) {
    throw fail(409, 'ต้องมี ADMIN ที่ใช้งานอยู่อย่างน้อย 1 คน');
  }
}
