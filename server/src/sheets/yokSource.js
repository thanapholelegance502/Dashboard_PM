// ตัวประกอบร่าง: client + cache + mapping + domain → payload ของบอร์ด YOK
// ที่เดียวที่ไม่ pure — ส่วนคำนวณทั้งหมดอยู่ใน domain/ เพื่อ test ได้โดยไม่ต้องมี network
import { env } from '../config/env.js';
import { batchGetValues, getSheetTabs } from './client.js';
import { createTtlCache } from './cache.js';
import { SHEET_MAP, YOK_TABS } from './mapping.js';
import { readTab, SheetMappingError } from './rows.js';
import { computeYokBoard } from '../domain/yokBoard.js';

const SHEET_BASE = 'https://docs.google.com/spreadsheets/d';

let tabsMetaCache = null; // { title, gid }[] — เปลี่ยนไม่บ่อย ดึงตอน cold start

async function loadTabsMeta() {
  if (tabsMetaCache) return tabsMetaCache;
  tabsMetaCache = await getSheetTabs(env.yokSheetId);
  return tabsMetaCache;
}

async function fetchBoard() {
  const meta = await loadTabsMeta();
  const present = new Set(meta.map((t) => t.title));
  const gidOf = new Map(meta.map((t) => [t.title, t.gid]));

  // ดึงเฉพาะแท็บที่มีจริง — แท็บหายจะได้ขึ้น warning แทนที่จะทำทั้ง batch พัง
  const want = YOK_TABS.filter((t) => present.has(t));
  const missingTabs = YOK_TABS.filter((t) => !present.has(t));
  const values = want.length ? await batchGetValues(env.yokSheetId, want) : {};

  const tabs = {};
  const mappingWarnings = [];
  for (const name of want) {
    const spec = SHEET_MAP[name];
    if (!spec || Object.keys(spec.fields).length === 0) continue;
    try {
      tabs[name] = readTab(name, values[name] ?? [], spec);
    } catch (err) {
      if (err instanceof SheetMappingError && !spec.required) {
        mappingWarnings.push({ tab: name, kind: 'mappingFailed', message: err.message });
        continue;
      }
      throw err; // แท็บ required map ไม่ได้ → ไม่ยอมโชว์เลขมั่ว
    }
  }

  const board = computeYokBoard({ tabs, gidOf, now: new Date() });
  for (const t of missingTabs) board.warnings.push({ tab: t, kind: 'tabMissing' });
  board.warnings.push(...mappingWarnings);

  return {
    sheetUrl: `${SHEET_BASE}/${env.yokSheetId}/edit`,
    tabs: meta.map((t) => t.title),
    ...board,
  };
}

/** 200 แต่ทุกแท็บว่าง = failure ที่หน้าตาเหมือนสำเร็จ → เก็บรอบก่อนไว้ */
function isSuspect(data) {
  const s = data?.sections;
  if (!s) return true;
  return (
    s.weeklyUpdate.items.length === 0 &&
    s.billing.items.length === 0 &&
    s.maTracking.items.length === 0 &&
    s.executiveAction.items.length === 0
  );
}

const boardCache = createTtlCache({ ttlMs: env.yokCacheTtlMs, fetcher: fetchBoard, isSuspect });

/** payload ของหน้าบอร์ด (asOf/stale/ageSec มาจาก cache) */
export async function getYokBoard() {
  const { data, asOf, ageSec, stale, staleReason, degraded } = await boardCache.get();
  return { asOf, ageSec, stale, ...(staleReason ? { staleReason } : {}), ...(degraded ? { degraded } : {}), ...data };
}

/** ข้อมูล debug สำหรับ ADMIN — โครงสร้างล้วน ไม่มีแถวข้อมูล */
export async function getYokMeta() {
  const snap = boardCache.peek();
  const meta = await loadTabsMeta();
  return {
    sheetId: env.yokSheetId,
    ttlMs: env.yokCacheTtlMs,
    tabs: meta.map((t) => ({ title: t.title, gid: t.gid })),
    mapped: Object.keys(SHEET_MAP).filter((t) => Object.keys(SHEET_MAP[t].fields).length > 0),
    cache: snap ? { asOf: snap.asOf, ageSec: snap.ageSec, stale: snap.stale } : null,
    warnings: snap?.data?.warnings ?? [],
  };
}

export function invalidateYokCache() {
  boardCache.invalidate();
  tabsMetaCache = null;
}
