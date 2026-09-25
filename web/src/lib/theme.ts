import type { ProjectStatus } from './types';

// design system v0.1 — ค่าเดียวกับ tailwind.config.js (ใช้ตรงใน SVG/Recharts ที่ต้องการ hex)
// แดง = ปัญหาเท่านั้น
export const COLORS = {
  brand: '#22406B',
  brandSoft: '#A8B7CC',
  navy: '#16263F',
  ink: '#1B1D22',
  ink2: '#4A4E57',
  ink3: '#7A7F88',
  line: '#E2DFD8',
  hair: '#EFEDE8',
  surface2: '#F1EFEA',
  ontrack: '#2F8A5B',
  atrisk: '#C98A12',
  delayed: '#B42F26',
  done: '#3E6394',
  waiting: '#5E636C',
  doing: '#22406B',
  slate: '#7A7F88',
};

// จุดสีหน้า label ของ KPI card
export type Tone = 'neutral' | 'ontrack' | 'atrisk' | 'delayed' | 'info' | 'waiting' | 'done';
export const TONE_DOT: Record<Tone, string> = {
  neutral: COLORS.ink,
  info: COLORS.brand,
  ontrack: COLORS.ontrack,
  atrisk: COLORS.atrisk,
  delayed: COLORS.delayed,
  waiting: COLORS.waiting,
  done: COLORS.done,
};

export function statusColor(s: ProjectStatus): string {
  switch (s) {
    case 'ON_TRACK': return COLORS.ontrack;
    case 'AT_RISK': return COLORS.atrisk;
    case 'DELAYED': return COLORS.delayed;
    case 'DONE': return COLORS.done;
    case 'WAITING': return COLORS.waiting;
    default: return COLORS.slate;
  }
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  DELAYED: 'Delayed',
  DONE: 'Done',
  WAITING: 'Waiting',
};

// badge สถานะ — fg / bg / border (tailwind class)
export const STATUS_PILL: Record<ProjectStatus, string> = {
  ON_TRACK: 'border-ok-bd bg-ok-bg text-ok',
  AT_RISK: 'border-risk-bd bg-risk-bg text-risk',
  DELAYED: 'border-late-bd bg-late-bg text-late',
  DONE: 'border-done-bd bg-done-bg text-done',
  WAITING: 'border-wait-bd bg-wait-bg text-wait',
};

// แท่ง Gantt — พื้นอ่อน + ขอบสีสถานะ
export const STATUS_BAR: Record<ProjectStatus, { bg: string; bd: string }> = {
  ON_TRACK: { bg: '#E8F4EC', bd: '#BFDFCB' },
  AT_RISK: { bg: '#FBF3E0', bd: '#EBD9A8' },
  DELAYED: { bg: '#FBEAE8', bd: '#F0C9C4' },
  DONE: { bg: '#EAF0F7', bd: '#C6D4E6' },
  WAITING: { bg: '#F1EFEA', bd: '#DAD6CE' },
};

// สี bucket (donut/stacked bar งานต่อสถานะ)
export const BUCKET_COLOR: Record<string, string> = {
  DONE: COLORS.ontrack,
  IN_PROGRESS: COLORS.brand,
  BACKLOG: COLORS.slate,
  WAITING: COLORS.waiting,
  BLOCKED: COLORS.delayed,
};
