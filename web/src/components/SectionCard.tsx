interface Props {
  title: string;
  count?: number; // pill ตัวเลขข้าง title (แดงเมื่อ > 0 และ countTone='alert')
  countTone?: 'alert' | 'neutral';
  right?: React.ReactNode;
  flush?: boolean; // เนื้อหาชิดขอบ (รายการ/ตาราง) — ไม่มี padding
  className?: string;
  children: React.ReactNode;
}

export default function SectionCard({ title, count, countTone = 'neutral', right, flush, className = '', children }: Props) {
  const pill = countTone === 'alert' && count ? 'bg-late-bg text-late' : 'bg-surface-2 text-ink-2';
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-[18px] py-3.5">
        <h2 className="text-base font-semibold">{title}</h2>
        {count !== undefined && <span className={`rounded-full px-2 text-xs font-semibold tabular-nums ${pill}`}>{count}</span>}
        {right && <div className="ml-auto flex items-center gap-2 text-xs text-ink-3">{right}</div>}
      </div>
      <div className={flush ? '' : 'p-[18px]'}>{children}</div>
    </section>
  );
}

/** state ว่าง — จุดสี + ข้อความ (header ของการ์ดยังอยู่) */
export function EmptyState({ text, sub, tone = 'ok' }: { text: string; sub?: string; tone?: 'ok' | 'muted' }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
      <span className={`h-2.5 w-2.5 rounded-full ${tone === 'ok' ? 'bg-ok' : 'bg-line-strong'}`} />
      <span className="text-sm font-semibold">{text}</span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </div>
  );
}

/** state กำลังโหลด — skeleton 3 แถว */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  const w = ['w-full', 'w-4/5', 'w-3/5', 'w-11/12', 'w-2/3'];
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, i) => <div key={i} className={`skeleton h-3.5 ${w[i % w.length]}`} />)}
    </div>
  );
}

/** state error — กล่องแดงอ่อน + ปุ่มลองใหม่ */
export function ErrorBox({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-late-bg p-3">
      <span className="text-sm font-semibold text-late">{title}</span>
      {detail && <span className="text-xs text-ink-2">{detail}</span>}
      {onRetry && <button onClick={onRetry} className="btn-secondary btn-sm mt-1 self-start">ลองใหม่</button>}
    </div>
  );
}
