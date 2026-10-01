// แปลงค่าดิบจาก Google Sheet → ชนิดที่ใช้งานได้ — pure ทั้งไฟล์
// ‼️ ทุกตัวคืน null เมื่ออ่านไม่ออก · ห้ามคืน NaN / Invalid Date / 0 แทนค่าว่าง (DESIGN-BRIEF §11)
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { BKK } from './time.js';

// Google serial date: วันที่ 1 = 1899-12-31 → epoch จริงคือ 1899-12-30
const SERIAL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** ปี พ.ศ. → ค.ศ. (ชีตคนไทยเจอจริง · ไม่แปลงจะได้วันที่ล่วงหน้า 543 ปีโดยไม่มี error) */
function toCE(year) {
  return year > 2400 ? year - 543 : year;
}

function ymd(y, m, d) {
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return null;
  const yy = toCE(y);
  const iso = `${String(yy).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // ตรวจว่าเป็นวันที่มีจริง (กัน 31 ก.พ.)
  const probe = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.getUTCDate() !== d) return null;
  return iso;
}

/**
 * ค่าในเซลล์ → 'YYYY-MM-DD' (ตามวันของ Asia/Bangkok) หรือ null
 * ลำดับ: serial number → ISO → DD/MM/YYYY (day-first) → D MMM YYYY (ไทย/อังกฤษ)
 * ⚠️ 03/04/2026 = 3 เม.ย. ไม่ใช่ 3 มี.ค. — เว็บหยก format en-GB (day-first)
 *    อ่านแบบอเมริกันจะได้คำตอบที่ดูสมเหตุสมผลแต่ผิด และเงียบสนิท
 */
export function parseSheetDate(v) {
  if (v == null || v === '') return null;

  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v <= 0) return null;
    const utc = new Date(SERIAL_EPOCH_UTC + Math.floor(v) * DAY_MS);
    const z = toZonedTime(utc, BKK);
    return ymd(z.getFullYear(), z.getMonth() + 1, z.getDate());
  }

  const s = String(v).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/);
  if (m) return ymd(Number(m[1]), Number(m[2]), Number(m[3]));

  // day-first เสมอ
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return ymd(Number(m[3]), Number(m[2]), Number(m[1]));

  // 3 ก.ย. 2569 / 3 Sep 2026
  m = s.match(/^(\d{1,2})\s+([^\s\d]+)\.?\s*(\d{4})$/);
  if (m) {
    const mon = m[2].toLowerCase();
    let idx = TH_MONTHS.findIndex((t) => mon.startsWith(t.replace(/\.$/, '').toLowerCase()));
    if (idx === -1) idx = EN_MONTHS.findIndex((e) => mon.startsWith(e));
    if (idx !== -1) return ymd(Number(m[3]), idx + 1, Number(m[1]));
  }

  return null;
}

/** 'YYYY-MM-DD' → Date (เที่ยงคืนกรุงเทพ) — ใช้กับ daysUntil ของ domain/time.js */
export function sheetDateToDate(iso) {
  return iso ? fromZonedTime(`${iso}T00:00:00`, BKK) : null;
}

/** เงินบาท → number | null · '(1,234)' = ติดลบ · ห้ามคืน NaN ห้ามคืน 0 แทนค่าว่าง */
export function parseThb(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s || /^(-|—|n\/?a|tbd|na)$/i.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[฿, \s]/g, '').replace(/THB|บาท/gi, '');
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/**
 * ความคืบหน้า → 0..100 | null
 * ⚠️ 0.75 กับ 75 แยกกันไม่ได้ถ้าไม่เห็นข้อมูลจริง — กติกา: ตัวเลข <= 1 ถือเป็นสัดส่วน
 * ถ้าชีตปนทั้งสองแบบในคอลัมน์เดียว แก้อัตโนมัติไม่ได้ ต้องถามหยก
 */
export function parsePercent(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    const n = v <= 1 && v >= 0 ? v * 100 : v;
    return clampPct(n);
  }
  const s = String(v).trim();
  if (!s || /^(-|—|n\/?a|tbd)$/i.test(s)) return null;
  const hasPct = s.includes('%');
  const num = Number(s.replace(/[%\s,]/g, ''));
  if (!Number.isFinite(num)) return null;
  if (hasPct) return clampPct(num);
  return clampPct(num <= 1 && num >= 0 ? num * 100 : num);
}

function clampPct(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** ข้อความ → string | null (ไม่แปลง '' เป็น '') */
export function parseText(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
