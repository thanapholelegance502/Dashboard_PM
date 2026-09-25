import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLORS } from '../lib/theme';

const PALETTE = [COLORS.brand, COLORS.ontrack, COLORS.atrisk, COLORS.ink3, COLORS.done];
const DASH = ['', '', '', '4 4', '2 3'];

interface Props {
  series: Array<Record<string, number | string>>;
  codes: string[];
  weeksCollected: number;
  needForFull: number;
}

export default function TrendLine({ series, codes, weeksCollected, needForFull }: Props) {
  if (weeksCollected < needForFull) {
    const pctDone = needForFull ? Math.min(100, Math.round((weeksCollected / needForFull) * 100)) : 0;
    return (
      <div className="flex flex-col gap-2 py-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[34px] font-semibold leading-none tabular-nums">{weeksCollected}</span>
          <span className="text-sm text-ink-3">/ {needForFull}</span>
        </div>
        <span className="text-sm">เก็บข้อมูลมาแล้ว <b>{weeksCollected}</b> สัปดาห์</span>
        <div className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-brand-700" style={{ width: `${pctDone}%` }} />
        </div>
        <span className="text-xs text-ink-3">กราฟแนวโน้มจะสมบูรณ์เมื่อครบ {needForFull} สัปดาห์</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={series} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
        <CartesianGrid vertical={false} stroke={COLORS.hair} />
        <XAxis dataKey="week" fontSize={11} tick={{ fill: COLORS.ink3 }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
        <YAxis domain={[0, 100]} fontSize={11} tick={{ fill: COLORS.ink3 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 12, fontFamily: 'inherit' }} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: COLORS.ink2 }} />
        {codes.map((c, i) => (
          <Line key={c} type="monotone" dataKey={c} stroke={PALETTE[i % PALETTE.length]} strokeDasharray={DASH[i % DASH.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
