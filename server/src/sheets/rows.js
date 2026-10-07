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
    if (spec.aliases.some((a) => norm.includes(normalizeHeader(a)))) hits += 1;
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
    let col = -1;
    for (const alias of s.aliases) {
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
    const tried = missingRequired.map((f) => `${f} (ลอง: ${fields[f].aliases.join(' / ')})`).join(' · ');
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
export function readTab(tabName, rows, spec) {
  const resolved = resolveHeaders(tabName, rows, spec);
  const read = makeRowReader(resolved);
  const items = [];
  for (let i = resolved.headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || row.every((c) => c === '' || c == null)) continue;
    items.push(read(row, i + 1));
  }
  return { items, resolved };
}
