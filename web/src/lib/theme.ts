import type { ProjectStatus } from './types';

// design token §11 — แดง = ปัญหาเท่านั้น
export const COLORS = {
  navy: '#1e3a5f',
  ontrack: '#16a34a',
  atrisk: '#f59e0b',
  delayed: '#dc2626',
  doing: '#2563eb',
  waiting: '#9ca3af',
  done: '#16a34a',
  slate: '#64748b',
};

// tint พื้นอ่อน + สีเข้ม + วงแหวน สำหรับ KPI card (executive)
export type Tone = 'neutral' | 'ontrack' | 'atrisk' | 'delayed' | 'info' | 'waiting';
export const TONE: Record<Tone, { bg: string; ring: string; icon: string; text: string }> = {
  neutral: { bg: 'bg-slate-50', ring: 'ring-slate-200', icon: 'bg-slate-100 text-slate-500', text: 'text-slate-900' },
  info: { bg: 'bg-blue-50', ring: 'ring-blue-100', icon: 'bg-blue-100 text-blue-600', text: 'text-slate-900' },
  ontrack: { bg: 'bg-emerald-50', ring: 'ring-emerald-100', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
  atrisk: { bg: 'bg-amber-50', ring: 'ring-amber-100', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
  delayed: { bg: 'bg-red-50', ring: 'ring-red-100', icon: 'bg-red-100 text-red-600', text: 'text-red-700' },
  waiting: { bg: 'bg-slate-50', ring: 'ring-slate-200', icon: 'bg-slate-100 text-slate-500', text: 'text-slate-600' },
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

// สี bucket (donut/stacked bar งานต่อสถานะ)
export const BUCKET_COLOR: Record<string, string> = {
  DONE: COLORS.ontrack,
  IN_PROGRESS: COLORS.doing,
  BACKLOG: COLORS.slate,
  WAITING: COLORS.waiting,
  BLOCKED: COLORS.delayed,
};
