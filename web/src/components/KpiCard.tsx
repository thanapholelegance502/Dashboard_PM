import { TONE, type Tone } from '../lib/theme';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export default function KpiCard({ label, value, sub, tone = 'neutral', icon, onClick }: Props) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-center gap-3 rounded-xl ${t.bg} p-4 text-left shadow-sm ring-1 ${t.ring} transition ${
        onClick ? 'cursor-pointer hover:shadow-md' : 'cursor-default'
      }`}
    >
      {icon && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.icon}`}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500">{label}</span>
        <span className={`block text-2xl font-bold leading-tight tabular-nums ${t.text}`}>{value}</span>
        {sub && <span className="block text-[11px] text-slate-400">{sub}</span>}
      </span>
    </button>
  );
}
