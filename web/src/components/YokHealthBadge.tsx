import { YOK_HEALTH_COLOR, YOK_HEALTH_LABEL } from '../lib/theme';
import type { YokHealth } from '../lib/types';

/** ป้ายสถานะของบอร์ด YOK — แยกจาก StatusBadge เพราะ enum คนละชุด (NOT_START/BLOCKED ไม่มีในของเรา) */
export default function YokHealthBadge({ health }: { health: YokHealth | null }) {
  if (!health) return <span className="text-xs text-ink-3">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: YOK_HEALTH_COLOR[health] }} />
      {YOK_HEALTH_LABEL[health] ?? health}
    </span>
  );
}
