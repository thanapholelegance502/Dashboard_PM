interface Props {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'normal' | 'warn' | 'danger';
  onClick?: () => void;
}

const toneClass: Record<string, string> = {
  normal: 'text-slate-800',
  warn: 'text-atrisk',
  danger: 'text-delayed',
};

export default function KpiCard({ label, value, sub, tone = 'normal', onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-start rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition ${
        onClick ? 'hover:ring-doing hover:shadow cursor-pointer' : 'cursor-default'
      }`}
    >
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className={`mt-1 text-3xl font-bold tabular-nums ${toneClass[tone]}`}>{value}</span>
      {sub && <span className="mt-0.5 text-xs text-slate-400">{sub}</span>}
    </button>
  );
}
