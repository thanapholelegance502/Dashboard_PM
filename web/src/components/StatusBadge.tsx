import type { ProjectStatus } from '../lib/types';
import { STATUS_LABEL, STATUS_PILL } from '../lib/theme';

interface Props {
  status: ProjectStatus;
  source: 'AUTO' | 'OVERRIDE';
  reasons?: string[];
  autoStatus?: ProjectStatus;
}

export default function StatusBadge({ status, source, reasons = [], autoStatus }: Props) {
  const isOverride = source === 'OVERRIDE';
  const tooltip = isOverride
    ? `PM ปรับเป็น ${STATUS_LABEL[status]} · ระบบคำนวณได้ ${autoStatus ? STATUS_LABEL[autoStatus] : '—'}`
    : reasons.length ? `${STATUS_LABEL[status]} เพราะ: ${reasons.join(' · ')}` : STATUS_LABEL[status];

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-0.5 pl-[7px] pr-[9px] text-xs font-semibold ${STATUS_PILL[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}
