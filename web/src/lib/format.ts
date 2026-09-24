import { format, differenceInHours } from 'date-fns';

/** ห้ามแสดง 0 แทน "ไม่มีข้อมูล" (§11) — null/undefined → — */
export function dash(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v}%`;
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  try {
    return format(new Date(v), 'd MMM yy');
  } catch {
    return '—';
  }
}

export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '—';
  try {
    return format(new Date(v), 'd MMM HH:mm');
  } catch {
    return '—';
  }
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

/** เงินบาท: 1,500,000 ฿ */
export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${v.toLocaleString('th-TH')} ฿`;
}
