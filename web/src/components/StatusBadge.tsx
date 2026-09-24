import type { ProjectStatus } from '../lib/types';
import { STATUS_LABEL, TONE, type Tone } from '../lib/theme';

interface Props {
  status: ProjectStatus;
  source: 'AUTO' | 'OVERRIDE';
  reasons?: string[];
  autoStatus?: ProjectStatus;
}

const STATUS_TONE: Record<ProjectStatus, Tone> = {
  ON_TRACK: 'ontrack', DONE: 'ontrack', AT_RISK: 'atrisk', DELAYED: 'delayed', WAITING: 'waiting',
};

export default function StatusBadge({ status, source, reasons = [], autoStatus }: Props) {
  const t = TONE[STATUS_TONE[status]];
  const isOverride = source === 'OVERRIDE';
  const tooltip = isOverride
    ? `PM ปรับเป็น ${STATUS_LABEL[status]} · ระบบคำนวณได้ ${autoStatus ? STATUS_LABEL[autoStatus] : '—'}`
    : reasons.length ? `${STATUS_LABEL[status]} เพราะ: ${reasons.join(' · ')}` : STATUS_LABEL[status];

  return (
    <span title={tooltip} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${t.bg} ${t.text} ring-1 ${t.ring}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
