import type { ProjectStatus } from '../lib/types';
import { statusColor, STATUS_LABEL } from '../lib/theme';

interface Props {
  status: ProjectStatus;
  source: 'AUTO' | 'OVERRIDE';
  reasons?: string[];
  autoStatus?: ProjectStatus;
}

export default function StatusBadge({ status, source, reasons = [], autoStatus }: Props) {
  const color = statusColor(status);
  const isOverride = source === 'OVERRIDE';
  const tooltip = isOverride
    ? `PM ปรับเป็น ${STATUS_LABEL[status]} · ระบบคำนวณได้ ${autoStatus ? STATUS_LABEL[autoStatus] : '—'}`
    : reasons.length
    ? `${STATUS_LABEL[status]} เพราะ: ${reasons.join(' · ')}`
    : STATUS_LABEL[status];

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {isOverride && <span aria-label="override">🔒</span>}
      {STATUS_LABEL[status]}
    </span>
  );
}
