import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface Slice {
  name: string;
  value: number;
  color: string;
  onClick?: () => void;
}

export default function DonutChart({ data, centerLabel }: { data: Slice[]; centerLabel?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-slate-400">— ไม่มีข้อมูล</div>;
  }
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} cursor={d.onClick ? 'pointer' : 'default'} onClick={d.onClick} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number, n: string) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-xs text-slate-400">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
