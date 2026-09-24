// Enum กลาง — MASTER §4 (ห้ามตั้งชื่อใหม่)

export const DEPT = Object.freeze({
  PM: 'PM',
  BA: 'BA',
  UXUI: 'UXUI',
  DEV: 'DEV',
  QA: 'QA',
  NONE: 'NONE', // section ที่ยังไม่มี rule → เตือนในหน้า Admin
});

export const BUCKET = Object.freeze({
  BACKLOG: 'BACKLOG', // เข้าคิว ยังไม่เริ่ม
  IN_PROGRESS: 'IN_PROGRESS', // กำลังทำ
  WAITING: 'WAITING', // รอฝั่งอื่น — ยังนับเป็น "ค้าง"
  DONE: 'DONE', // จบในมุมแผนกนั้น
  BLOCKED: 'BLOCKED', // ติดปัญหา (bucket ปกติ ไม่ใช่ flag แยก — MASTER §4.2)
});

// bucket ที่นับเป็น "ค้าง / open / active" (MASTER §4.3)
export const OPEN_BUCKETS = Object.freeze([
  BUCKET.BACKLOG,
  BUCKET.IN_PROGRESS,
  BUCKET.WAITING,
]);

export const PROJECT_STATUS = Object.freeze({
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  DELAYED: 'DELAYED',
  DONE: 'DONE',
  WAITING: 'WAITING', // รอเริ่ม — PM ตั้งผ่าน override เท่านั้น (auto ไม่คืนค่านี้)
});

export const MATCH_TYPE = Object.freeze({
  EXACT: 'EXACT',
  CONTAINS: 'CONTAINS',
  FALLBACK: 'FALLBACK',
});
