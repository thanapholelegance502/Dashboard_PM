import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { COLORS } from '../lib/theme';

const PALETTE = [COLORS.doing, COLORS.ontrack, COLORS.atrisk, COLORS.slate, '#7c3aed'];

interface Props {
  series: Array<Record<string, number | string>>;
  codes: string[];
  weeksCollected: number;
  needForFull: number;
}

export default function TrendLine({ series, codes, weeksCollected, needForFull }: Props) {
  if (weeksCollected < needForFull) {
    return (
      <div className="flex h-52 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
        <span className="text-3xl">📈</span>
        เก็บข้อมูลมาแล้ว <b>{weeksCollected}</b> สัปดาห์
        <span className="text-xs text-slate-400">กราฟแนวโน้มจะสมบูรณ์เมื่อครบ {needForFull} สัปดาห์</span>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={series} margin={{ top: 8, right: 16, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="week" fontSize={11} />
        <YAxis domain={[0, 100]} fontSize={11} />
        <Tooltip />
        <Legend />
        {codes.map((c, i) => (
          <Line key={c} type="monotone" dataKey={c} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
