/**
 * ขั้นตอนงาน 13 ขั้น — เรียงลำดับ ไม่ใช่สัดส่วน
 * donut ทำลายลำดับ · Gantt ต้องมีวันที่ → จึงเขียนเอง (ไม่พึ่ง Recharts)
 */
export default function StageFunnel({
  data, onPick,
}: { data: Array<{ key: string; count: number }>; onPick?: (stage: string) => void }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2">
      {data.map((d) => {
        const empty = d.count === 0;
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={empty ? 'text-ink-3' : 'text-ink-2'}>{d.key}</span>
              <span className={`tabular-nums ${empty ? 'text-ink-3' : 'font-semibold text-ink'}`}>{d.count}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand-700 transition-opacity group-enabled:group-hover:opacity-80" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </>
        );
        if (!onPick || empty) return <div key={d.key}>{body}</div>;
        return (
          <button key={d.key} type="button" onClick={() => onPick(d.key)} className="group w-full text-left">
            {body}
          </button>
        );
      })}
    </div>
  );
}
