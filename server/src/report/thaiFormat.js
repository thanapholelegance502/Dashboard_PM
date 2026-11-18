// รูปแบบวันที่ไทย พ.ศ. เขตเวลากรุงเทพ — ‼️ ต้องตรงกับ web/src/lib/format.ts (แก้ที่หนึ่งต้องแก้อีกที่)
const TZ = 'Asia/Bangkok';
const dateFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', timeZone: TZ });
const monYearFmt = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit', timeZone: TZ });
const isoFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });

function toDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 20 พ.ย. 69 */
export function fmtDate(v) {
  const d = toDate(v);
  return d ? dateFmt.format(d) : '—';
}

/** 20 พ.ย. 69 · 17:30 น. */
export function fmtDateTime(v) {
  const d = toDate(v);
  return d ? `${dateFmt.format(d)} · ${timeFmt.format(d)} น.` : '—';
}

/** YYYY-MM-DD ตามวันกรุงเทพ (ใช้ตั้งชื่อไฟล์) */
export function isoDateBkk(v) {
  const d = toDate(v);
  return d ? isoFmt.format(d) : '';
}

/** วันในสัปดาห์ตามกรุงเทพ 0=อาทิตย์ … 6=เสาร์ */
function weekdayBkk(d) {
  const iso = isoFmt.format(d); // YYYY-MM-DD
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

/** ช่วงวันทำงานของสัปดาห์ที่ now อยู่: "16–20 พ.ย. 69" (จันทร์–ศุกร์) */
export function workWeekRange(now) {
  const d = toDate(now);
  const wd = weekdayBkk(d);
  const toMon = wd === 0 ? -6 : 1 - wd;
  const mon = new Date(d.getTime() + toMon * 864e5);
  const fri = new Date(mon.getTime() + 4 * 864e5);
  const sameMonth = monYearFmt.format(mon) === monYearFmt.format(fri);
  return sameMonth
    ? `${dayFmt.format(mon)}–${dayFmt.format(fri)} ${monYearFmt.format(fri)}`
    : `${dateFmt.format(mon)} – ${dateFmt.format(fri)}`;
}
