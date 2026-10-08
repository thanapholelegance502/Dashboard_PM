// แปลงตารางดิบจากชีต → แถวที่มีชื่อ field — pure ทั้งไฟล์
// ‼️ error ที่โยนจากที่นี่ echo ได้แค่ "หัวคอลัมน์" ห้ามเอาค่าในแถวใส่ (MASTER §12.5 log ห้ามหลุดชื่อลูกค้า)

export class SheetMappingError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'SheetMappingError';
    this.status = 503;
    this.detail = detail;
  }
}

/** ทนต่อการแก้หัวตารางที่เกิดจริง: เว้นวรรคท้าย · เปลี่ยน case · เติมดอกจัน/โคลอน · NBSP/zero-width */
export function normalizeHeader(raw) {
  return String(raw ?? '')
    .replace(/[ ​﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[*:：]+$/, '')
    .trim()
    .toLowerCase();
}

function aliasHits(rowCells, fields) {
  const norm = rowCells.map(normalizeHeader);
  let hits = 0;
  for (const spec of Object.values(fields)) {
    // field ที่ตรึง col ไว้ ไม่มี aliases ให้นับ
    if ((spec.aliases ?? []).some((a) => norm.includes(normalizeHeader(a)))) hits += 1;
  }
  return hits;
}

/**
 * หาแถวหัวตาราง + map field → index คอลัมน์
 * headerRow: เลข 0-based หรือ 'auto' (สแกน 5 แถวแรก เผื่อมีแถว banner อยู่ข้างบน)
 */
export function resolveHeaders(tabName, rows, spec) {
  const { fields, headerRow = 'auto' } = spec;
  if (!rows || rows.length === 0) {
    throw new SheetMappingError(`แท็บ "${tabName}" ไม่มีข้อมูลเลย`, { tab: tabName, headersSeen: [] });
  }

  let headerRowIndex = 0;
  if (headerRow === 'auto') {
    let best = -1;
    for (let i = 0; i < Math.min(5, rows.length); i += 1) {
      const h = aliasHits(rows[i] ?? [], fields);
      if (h > best) {
        best = h;
        headerRowIndex = i;
      }
    }
  } else {
    headerRowIndex = headerRow;
  }

  const headerCells = (rows[headerRowIndex] ?? []).map(normalizeHeader);
  const index = {};
  const missingRequired = [];
  const missingOptional = [];
  const matched = new Set();

  for (const [field, s] of Object.entries(fields)) {
    // คอลัมน์ที่หัวตารางว่าง (merged cell ในชีต) → ตรึง index ไว้ตรง ๆ
    // ใช้เมื่อไม่มีหัวให้ match เท่านั้น · ต้องเขียนหลักฐานกำกับใน mapping.js เสมอ
    if (typeof s.col === 'number') {
      index[field] = s.col;
      matched.add(s.col);
      continue;
    }
    let col = -1;
    for (const alias of (s.aliases ?? [])) {
      const at = headerCells.indexOf(normalizeHeader(alias));
      if (at !== -1) {
        col = at;
        break;
      }
    }
    if (col === -1) {
      (s.required ? missingRequired : missingOptional).push(field);
      continue;
    }
    index[field] = col;
    matched.add(col);
  }

  const headersSeen = (rows[headerRowIndex] ?? []).map((c) => String(c ?? '').trim()).filter(Boolean);
  const unknownHeaders = (rows[headerRowIndex] ?? [])
    .map((c, i) => (matched.has(i) ? null : String(c ?? '').trim()))
    .filter(Boolean);

  if (missingRequired.length) {
    const tried = missingRequired.map((f) => `${f} (ลอง: ${(fields[f].aliases ?? []).join(' / ') || 'ไม่มี alias'})`).join(' · ');
    throw new SheetMappingError(
      `แท็บ "${tabName}" ไม่พบคอลัมน์ที่จำเป็น: ${tried} — หัวตารางที่เจอ: ${headersSeen.join(' | ') || '(ว่าง)'}`,
      { tab: tabName, missingRequired, headersSeen }
    );
  }

  return { headerRowIndex, index, missingRequired, missingOptional, unknownHeaders, headersSeen };
}

/** อ่านแถว → object · แถวสั้น (batchGet ตัดช่องว่างท้ายทิ้ง) ได้ null ไม่ใช่ crash */
export function makeRowReader(resolved) {
  const { index } = resolved;
  return (row, rowNumber) => {
    const out = { _row: rowNumber };
    for (const [field, col] of Object.entries(index)) {
      const v = row?.[col];
      out[field] = v === undefined || v === '' ? null : v;
    }
    return out;
  };
}

/** แถวข้อมูลทั้งหมดของ tab (ข้ามหัวตาราง, ทิ้งแถวว่างล้วน) · rowNumber = เลขแถวจริงในชีต (1-based) */
/**
 * บางแท็บมี 2 ตารางซ้อนกัน (เช่น Project_Billing: สรุปรายโครงการ → banner คั่น → ตารางงวด)
 * startAfter = เริ่มอ่านหลังแถวที่ col0 ตรง regex · stopWhen = หยุดเมื่อ col0 ตรง regex
 * ใช้ regex ไม่ใช่เลขแถว → หยกแทรกแถวข้างบนแล้วไม่พัง
 */
function sliceTable(rows, spec) {
  let start = 0;
  if (spec.startAfter) {
    const at = rows.findIndex((r) => spec.startAfter.test(String(r?.[0] ?? '')));
    if (at === -1) return { rows: [], offset: 0, notFound: true };
    start = at + 1;
  }
  let end = rows.length;
  if (spec.stopWhen) {
    const at = rows.slice(start).findIndex((r) => spec.stopWhen.test(String(r?.[0] ?? '')));
    if (at !== -1) end = start + at;
  }
  return { rows: rows.slice(start, end), offset: start, notFound: false };
}

export function readTab(tabName, rows, spec) {
  const { rows: slice, offset, notFound } = sliceTable(rows, spec);
  if (notFound) {
    throw new SheetMappingError(`แท็บ "${tabName}" ไม่พบจุดเริ่มตาราง (startAfter)`, { tab: tabName, headersSeen: [] });
  }
  const resolved = resolveHeaders(tabName, slice, spec);
  const read = makeRowReader(resolved);
  const items = [];
  for (let i = resolved.headerRowIndex + 1; i < slice.length; i += 1) {
    const row = slice[i];
    if (!row || row.every((c) => c === '' || c == null)) continue;
    // _row = เลขแถวจริงในชีต (1-based) นับรวม offset ของตารางที่สอง
    items.push(read(row, offset + i + 1));
  }
  return { items, resolved };
}
