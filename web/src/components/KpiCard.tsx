import { TONE_DOT, type Tone } from '../lib/theme';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
  problem?: boolean; // แดง = ปัญหาเท่านั้น — ขอบ/ตัวเลขแดงเมื่อเป็นปัญหาจริง
  title?: string; // tooltip (เช่น ยอดเงินเต็ม)
  onClick?: () => void;
}

export default function KpiCard({ label, value, sub, tone = 'neutral', problem, title, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={title}
      className={`flex min-w-0 flex-col gap-1 rounded-xl border bg-surface px-4 py-3.5 text-left shadow-card transition ${
        problem ? 'border-late-bd' : 'border-line'
      } ${onClick ? 'cursor-pointer hover:border-brand-700 hover:shadow-hover' : 'cursor-default'}`}
    >
      <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: TONE_DOT[tone] }} />
        <span className="truncate">{label}</span>
      </span>
      <span className={`text-[28px] font-semibold leading-tight tracking-tight tabular-nums md:text-[34px] ${problem ? 'text-late' : 'text-ink'}`}>
        {value}
      </span>
      {sub && <span className={`text-xs ${problem ? 'text-late' : 'text-ink-3'}`}>{sub}</span>}
    </button>
  );
}
