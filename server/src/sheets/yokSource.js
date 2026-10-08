// ตัวประกอบร่างของบอร์ด YOK: ดึงชีต → map → คำนวณ → เก็บลง Postgres
// หน้าเว็บอ่านจาก snapshot ล่าสุดที่สำเร็จเสมอ → restart/deploy/Google ล่ม แล้วหน้าไม่ว่าง (MASTER §12.4)
//
// แหล่งข้อมูล 2 ทาง สลับด้วย env YOK_SOURCE:
//   gviz (default) — ยิง endpoint เดียวกับเว็บเดิมของหยก · ไม่ต้องมี credential
//                    ‼️ ใช้ได้เฉพาะตอนชีตเปิด "anyone with the link" = ปิดชีตไม่ได้
//   api            — service account · ปิดชีตได้จริง (ดู docs/YOK-BOARD.md)
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { gvizGetTabs } from './gvizClient.js';
import { batchGetValues, getSheetTabs } from './client.js';
import { SHEET_MAP, YOK_TABS, VIRTUAL_TABS } from './mapping.js';
import { readTab, SheetMappingError } from './rows.js';
import { computeYokBoard } from '../domain/yokBoard.js';

const SHEET_BASE = 'https://docs.google.com/spreadsheets/d';

let apiTabsMeta = null; // เฉพาะโหมด api — gviz ไม่มี endpoint บอก gid

async function loadRawTabs() {
  if (env.yokSource === 'api') {
    const meta = await getSheetTabs(env.yokSheetId);
    apiTabsMeta = meta;
    const present = new Set(meta.map((t) => t.title));
    const want = YOK_TABS.filter((t) => present.has(t));
    const values = want.length ? await batchGetValues(env.yokSheetId, want) : {};
    return {
      rows: Object.fromEntries(YOK_TABS.map((t) => [t, present.has(t) ? (values[t] ?? []) : null])),
      gidOf: new Map(meta.map((t) => [t.title, t.gid])),
    };
  }
  // gviz: ไม่รู้ gid → ลิงก์กลับชีตจะไม่ชี้แท็บเจาะจง (ยังเปิดชีตได้)
  const rows = await gvizGetTabs(YOK_TABS);
  return { rows, gidOf: new Map() };
}

/** ดึง → map → คำนวณ (ไม่แตะ DB) */
export async function fetchYokBoard() {
  const { rows, gidOf } = await loadRawTabs();

  const tabs = {};
  const extraWarnings = [];
  const rowCounts = {};

  // แท็บจริง + แท็บเสมือน (ตารางที่สองในแท็บเดียวกัน) อ่านด้วยกลไกเดียวกัน
  const readTargets = [
    ...YOK_TABS.map((t) => [t, t]),
    ...Object.entries(VIRTUAL_TABS), // [ชื่อใน SHEET_MAP, แท็บจริง]
  ];
  for (const [name, sourceTab] of readTargets) {
    const raw = rows[sourceTab];
    if (raw == null) {
      if (name === sourceTab) extraWarnings.push({ tab: name, kind: 'tabMissing' });
      continue;
    }
    if (name === sourceTab) rowCounts[name] = raw.length;
    const spec = SHEET_MAP[name];
    if (!spec || Object.keys(spec.fields).length === 0) continue;
    try {
      tabs[name] = readTab(name, raw, spec);
    } catch (err) {
      if (err instanceof SheetMappingError && !spec.required) {
        extraWarnings.push({ tab: name, kind: 'mappingFailed', message: err.message });
        continue;
      }
      throw err; // แท็บ required map ไม่ได้ → ไม่ยอมเขียน snapshot ที่เลขมั่ว
    }
  }

  const board = computeYokBoard({ tabs, gidOf, now: new Date() });
  board.warnings.push(...extraWarnings);

  return {
    payload: {
      source: env.yokSource,
      sheetUrl: `${SHEET_BASE}/${env.yokSheetId}/edit`,
      tabs: YOK_TABS.filter((t) => rows[t] != null),
      ...board,
    },
    rowCounts,
  };
}

/** กวาด 1 รอบแล้วเขียนลงตาราง — รอบที่ล้มเก็บไว้ดู ไม่ทับรอบที่สำเร็จ */
export async function runYokSync({ trigger = 'CRON' } = {}) {
  const start = Date.now();
  try {
    const { payload, rowCounts } = await fetchYokBoard();
    const row = await prisma.yokSnapshot.create({
      data: { ok: true, payload, rowCounts, durationMs: Date.now() - start },
    });
    console.log(`[yok] กวาดสำเร็จ (${trigger}) ${Date.now() - start}ms · snapshot #${row.id}`);
    return { ok: true, id: row.id };
  } catch (err) {
    await prisma.yokSnapshot.create({
      data: { ok: false, errorText: String(err.message).slice(0, 500), durationMs: Date.now() - start },
    });
    console.error(`[yok] กวาดล้มเหลว (${trigger}):`, err.message);
    return { ok: false, error: err.message };
  }
}

/** payload ของหน้าบอร์ด — อ่าน snapshot ที่สำเร็จล่าสุด */
export async function getYokBoard() {
  const last = await prisma.yokSnapshot.findFirst({ where: { ok: true }, orderBy: { fetchedAt: 'desc' } });
  if (!last) {
    const err = new Error('ยังไม่เคยกวาดข้อมูลจากชีตสำเร็จ — กด "ดึงข้อมูลใหม่" ในหน้าบอร์ด หรือรอรอบถัดไป');
    err.status = 503;
    throw err;
  }
  // ถ้ารอบล่าสุดล้ม ให้บอกบนหน้าเว็บ ไม่ใช่เงียบ ๆ แล้วโชว์ข้อมูลเก่าเหมือนปกติ
  const newest = await prisma.yokSnapshot.findFirst({ orderBy: { fetchedAt: 'desc' } });
  const stale = newest != null && !newest.ok;
  const ageSec = Math.max(0, Math.round((Date.now() - last.fetchedAt.getTime()) / 1000));
  return {
    asOf: last.fetchedAt.toISOString(),
    ageSec,
    stale,
    ...(stale ? { staleReason: `กวาดรอบล่าสุดไม่สำเร็จ (${newest.errorText ?? 'ไม่ทราบสาเหตุ'})` } : {}),
    ...last.payload,
  };
}

/** debug สำหรับ ADMIN — โครงสร้างล้วน ไม่มีแถวข้อมูล */
export async function getYokMeta() {
  const recent = await prisma.yokSnapshot.findMany({
    orderBy: { fetchedAt: 'desc' },
    take: 10,
    select: { id: true, fetchedAt: true, ok: true, errorText: true, rowCounts: true, durationMs: true },
  });
  const last = await prisma.yokSnapshot.findFirst({ where: { ok: true }, orderBy: { fetchedAt: 'desc' } });
  return {
    sheetId: env.yokSheetId,
    source: env.yokSource,
    cron: { morning: env.yokCronMorning, evening: env.yokCronEvening },
    mapped: Object.keys(SHEET_MAP).filter((t) => Object.keys(SHEET_MAP[t].fields).length > 0),
    apiTabs: apiTabsMeta?.map((t) => t.title) ?? null,
    warnings: last?.payload?.warnings ?? [],
    recent,
  };
}
