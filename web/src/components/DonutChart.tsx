import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface Slice {
  name: string;
  value: number;
  color: string;
  onClick?: () => void;
}

export default function DonutChart({ data, centerLabel, size = 132 }: { data: Slice[]; centerLabel?: string; size?: number }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) {
    return <div className="flex items-center justify-center text-sm text-ink-3" style={{ height: size }}>— ไม่มีข้อมูล</div>;
  }
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} cursor={d.onClick ? 'pointer' : 'default'} onClick={d.onClick} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number, n: string) => [`${v} (${Math.round((v / total) * 100)}%)`, n]}
            contentStyle={{ borderRadius: 8, border: '1px solid #E2DFD8', fontSize: 12, fontFamily: 'inherit' }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-[11px] text-ink-3">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}
