// ทะเบียนบอร์ดแผนก + สิทธิ์รายคน (portal หลายแผนก) · pure function ไม่แตะ DB เพื่อ test ได้
// internal = หน้าใน SPA นี้ · external = แอปของทีมแผนกที่ nginx วางไว้ใต้ path (ดู docs/BOARD-INTEGRATION.md)
export const BOARDS = [
  { code: 'PM', name: 'PM · Portfolio', desc: 'Gantt · สถานะโครงการ · milestone', path: '/pm', kind: 'internal' },
  { code: 'QA', name: 'QA · Tester', desc: 'บั๊ก · defect · คุณภาพงานเทส', path: '/qa/', kind: 'external' },
  // repo Dashboard_C_level ยังว่าง → ชี้หน้าการเงินในระบบนี้ไปก่อน พอมีแอปค่อยย้ายไป /clevel แบบ QA
  { code: 'CLEVEL', name: 'C-level · การเงิน', desc: 'งบ · งวดเก็บเงิน · cash-flow', path: '/finance', kind: 'internal' },
  { code: 'BA', name: 'BA', desc: 'requirement · analysis', kind: 'soon' },
  { code: 'UX', name: 'UX/UI', desc: 'design · usability', kind: 'soon' },
];

/** บอร์ดที่เปิดใช้งานได้ (ให้สิทธิ์ได้) — ไม่รวมบอร์ด "เร็ว ๆ นี้" */
export const BOARD_CODES = BOARDS.filter((b) => b.kind !== 'soon').map((b) => b.code);

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** ตรวจรายการบอร์ดก่อนบันทึก · ไม่ใช่ array / มี code ไม่รู้จัก → throw 400 · ตัดซ้ำ + เรียงตามทะเบียน */
export function normalizeBoards(list) {
  if (!Array.isArray(list)) throw fail(400, 'boards ต้องเป็นรายการ');
  const codes = list.map((c) => String(c).toUpperCase());
  const unknown = codes.filter((c) => !BOARD_CODES.includes(c));
  if (unknown.length) throw fail(400, `ไม่รู้จักบอร์ด: ${unknown.join(', ')}`);
  return BOARD_CODES.filter((c) => codes.includes(c));
}

/** บอร์ดที่ user เข้าได้จริง · ADMIN = ทุกบอร์ด · ปิดใช้งาน = ไม่มี */
export function effectiveBoards(user) {
  if (!user || !user.isActive) return [];
  if (user.role === 'ADMIN') return [...BOARD_CODES];
  return BOARD_CODES.filter((c) => (user.boards ?? []).includes(c));
}

export function canAccessBoard(user, code) {
  return effectiveBoards(user).includes(String(code ?? '').toUpperCase());
}
