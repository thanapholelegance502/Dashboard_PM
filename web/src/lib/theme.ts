import type { ProjectStatus } from './types';

// design token §11 — แดง = ปัญหาเท่านั้น
export const COLORS = {
  ontrack: '#16a34a',
  atrisk: '#f59e0b',
  delayed: '#dc2626',
  doing: '#2563eb',
  waiting: '#9ca3af',
  done: '#16a34a',
  slate: '#64748b',
};

export function statusColor(s: ProjectStatus): string {
  switch (s) {
    case 'ON_TRACK': return COLORS.ontrack;
    case 'AT_RISK': return COLORS.atrisk;
    case 'DELAYED': return COLORS.delayed;
    case 'DONE': return COLORS.done;
    default: return COLORS.slate;
  }
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  ON_TRACK: 'On Track',
  AT_RISK: 'At Risk',
  DELAYED: 'Delayed',
  DONE: 'Done',
};

// สี bucket (donut/stacked bar งานต่อสถานะ)
export const BUCKET_COLOR: Record<string, string> = {
  DONE: COLORS.ontrack,
  IN_PROGRESS: COLORS.doing,
  BACKLOG: COLORS.slate,
  WAITING: COLORS.waiting,
  BLOCKED: COLORS.delayed,
};
