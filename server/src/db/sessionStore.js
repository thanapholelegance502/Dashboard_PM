// session store ใน Postgres (H-1) — restart / deploy / watchtower เปลี่ยน container แล้ว login ไม่หลุด
// ตาราง "session" สร้างโดย prisma migration (model Session) — ไม่ให้ connect-pg-simple สร้างเอง
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { env } from '../config/env.js';

const PgStore = connectPgSimple(session);

/** คืน store สำหรับ express-session · ไม่มี DATABASE_URL (เครื่อง dev ยังไม่ตั้ง DB) → undefined = MemoryStore */
export function createSessionStore() {
  if (!env.databaseUrl) {
    console.warn('[session] ไม่มี DATABASE_URL → ใช้ MemoryStore (restart แล้ว login หลุด)');
    return undefined;
  }
  const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 3 });
  pool.on('error', (err) => console.error('[session] pg pool error:', err.message));
  return new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60, // วินาที — ลบ session หมดอายุทุก 15 นาที
  });
}
