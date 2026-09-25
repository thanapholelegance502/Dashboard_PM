import { differenceInHours } from 'date-fns';

// รูปแบบตัวเลข/วันที่ (design system v0.1) — วันที่ พ.ศ. เขตเวลาไทย · เงินล้านบาทย่อ + tooltip เต็ม
const TZ = 'Asia/Bangkok';
const dateFmt = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ห้ามแสดง 0 แทน "ไม่มีข้อมูล" (§11) — null/undefined → — */
export function dash(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v}%`;
}

/** 24 ก.ย. 69 */
export function fmtDate(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? dateFmt.format(d) : '—';
}

/** 24 ก.ย. 69 · 09:30 น. */
export function fmtDateTime(v: string | null | undefined): string {
  const d = toDate(v);
  return d ? `${dateFmt.format(d)} · ${timeFmt.format(d)} น.` : '—';
}

/** sync เก่ากว่า 24 ชม.? (badge แดง §11) */
export function isStale(lastSyncAt: string | null): boolean {
  if (!lastSyncAt) return true;
  try {
    return differenceInHours(new Date(), new Date(lastSyncAt)) >= 24;
  } catch {
    return true;
  }
}

/** เงินบาทเต็ม: ฿1,500,000 */
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `฿${v.toLocaleString('th-TH')}`;
}

/** เงินย่อสำหรับตัวเลขใหญ่: 17.4 ลบ. (≥ 1 ล้าน) · ต่ำกว่านั้นแสดงเต็ม — คู่กับ title={money(v)} */
export function moneyShort(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) < 1_000_000) return money(v);
  return `${(v / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ลบ.`;
}
