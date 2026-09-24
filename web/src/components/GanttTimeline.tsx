import { useMemo } from 'react';
import type { ProjectRow } from '../lib/types';
import { COLORS, STATUS_BAR } from '../lib/theme';
import { fmtDate } from '../lib/format';
import StatusBadge from './StatusBadge';

const DAY = 86400000;
const WEEK = 7 * DAY;

// คอลัมน์ฝั่งซ้าย (sticky) — แก้ความกว้างที่นี่ที่เดียว
const COL = { idx: 34, project: 150, progress: 86, target: 106, actual: 106, status: 104 };
const LEFT_W = Object.values(COL).reduce((a, b) => a + b, 0);
const px = (n: number) => `${n}px`;

interface Props {
  projects: ProjectRow[];
  onProjectClick?: (code: string) => void;
}

function parse(v: string | null): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

export default function GanttTimeline({ projects, onProjectClick }: Props) {
  const { start, end, weeks } = useMemo(() => {
    const starts: number[] = [];
    const ends: number[] = [];
    for (const p of projects) {
      const s = parse(p.startDate);
      const e = parse(p.actualGolive) ?? parse(p.targetGolive);
      if (s) starts.push(s);
      if (e) ends.push(e);
    }
    const now = Date.now();
    const start = starts.length ? Math.min(...starts) : now - 4 * WEEK;
    const rawEnd = ends.length ? Math.max(...ends) : now + 8 * WEEK;
    const end = rawEnd + 2 * WEEK; // +2 สัปดาห์ (§6.1)
    const weeks: number[] = [];
    for (let t = start; t <= end; t += WEEK) weeks.push(t);
    return { start, end, weeks };
  }, [projects]);

  const span = end - start || 1;
  const pos = (t: number | null) => (t === null ? null : ((t - start) / span) * 100);
  const todayPos = pos(Date.now());
  const TRACK_MIN = Math.max(640, weeks.length * 48);

  return (
    <div>
      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hair px-[18px] py-2.5 text-[11px] text-ink-2">
        <LegendItem color={COLORS.ink3} soft label="UAT (Target)" />
        <LegendItem color={COLORS.ink3} label="UAT (Actual)" />
        <LegendItem color={COLORS.ink} soft label="Go-Live (Target)" />
        <LegendItem color={COLORS.ink} label="Go-Live (Actual)" />
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-[1.5px] bg-late" /> วันนี้</span>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: LEFT_W + TRACK_MIN }}>
        {/* header */}
        <div className="flex border-b border-line bg-surface text-xs font-medium text-ink-3">
          <div className="sticky left-0 z-10 flex shrink-0 bg-surface" style={{ width: LEFT_W }}>
            <Cell w={px(COL.idx)}>#</Cell>
            <Cell w={px(COL.project)}>Project</Cell>
            <Cell w={px(COL.progress)}>Progress</Cell>
            <Cell w={px(COL.target)}>Target Go-Live</Cell>
            <Cell w={px(COL.actual)}>Actual Go-Live</Cell>
            <Cell w={px(COL.status)} clip={false}>Status</Cell>
          </div>
          <div className="relative flex-1" style={{ minWidth: TRACK_MIN }}>
            {weeks.map((t, i) =>
              i % 2 === 0 ? (
                <span key={i} className={`absolute top-2 whitespace-nowrap text-[11px] font-normal ${i === 0 ? '' : '-translate-x-1/2'}`} style={{ left: `${pos(t)}%` }}>
                  {fmtDate(new Date(t).toISOString())}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* rows */}
        {projects.map((p, idx) => {
          const bStart = pos(parse(p.startDate));
          const bEnd = pos(parse(p.actualGolive) ?? parse(p.targetGolive));
          const late = p.slipDays != null && p.slipDays > 0 ? p.slipDays : null;
          return (
            <div key={p.code} className="group flex items-stretch border-b border-hair-2 last:border-b-0">
              <div className="sticky left-0 z-10 flex shrink-0 items-center bg-surface text-sm group-hover:bg-[#FAF9F6]" style={{ width: LEFT_W }}>
                <Cell w={px(COL.idx)}><span className="text-xs tabular-nums text-ink-3">{idx + 1}</span></Cell>
                <Cell w={px(COL.project)}>
                  <button className="truncate text-left font-medium text-brand-700 hover:underline" onClick={() => onProjectClick?.(p.code)}>
                    {p.displayName}
                  </button>
                </Cell>
                <Cell w={px(COL.progress)}>
                  <ProgressBar value={p.progressPct} override={p.progressSource === 'OVERRIDE'} />
                </Cell>
                <Cell w={px(COL.target)}>
                  <span className="text-xs tabular-nums text-ink-2">{fmtDate(p.targetGolive)}</span>
                </Cell>
                <Cell w={px(COL.actual)}>
                  {/* live แล้ว = วันจริง (+N ถ้าช้า) · ยังไม่ live แต่เลย target = เลย N วัน */}
                  {p.actualGolive ? (
                    <span
                      className={`text-xs tabular-nums ${late ? 'font-semibold text-late' : 'text-ink-2'}`}
                      title={late ? `Go-Live ช้ากว่า target ${late} วัน` : undefined}
                    >
                      {fmtDate(p.actualGolive)}
                      {late && <span className="ml-1 text-[10px]">+{late}</span>}
                    </span>
                  ) : late ? (
                    <span className="text-xs font-semibold text-late">เลย {late} วัน</span>
                  ) : (
                    <span className="text-xs text-ink-3">—</span>
                  )}
                </Cell>
                <Cell w={px(COL.status)} clip={false}>
                  <StatusBadge status={p.status} source={p.statusSource} reasons={p.statusReasons} autoStatus={p.statusAuto} />
                </Cell>
              </div>

              {/* timeline track */}
              <div className="relative flex-1 py-[18px] group-hover:bg-[#FAF9F6]" style={{ minWidth: TRACK_MIN }}>
                {/* week gridlines */}
                {weeks.map((t, i) => (
                  <span key={i} className="absolute top-0 h-full w-px bg-hair-2" style={{ left: `${pos(t)}%` }} />
                ))}
                {/* project bar */}
                {bStart !== null && bEnd !== null && (
                  <div
                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded border"
                    style={{ left: `${bStart}%`, width: `${Math.max(bEnd - bStart, 0.5)}%`, backgroundColor: STATUS_BAR[p.status].bg, borderColor: STATUS_BAR[p.status].bd }}
                  />
                )}
                {/* diamonds */}
                <Diamond p={pos(parse(p.targetUat))} color={COLORS.ink3} soft label={`UAT target ${fmtDate(p.targetUat)}`} />
                <Diamond p={pos(parse(p.actualUat))} color={COLORS.ink3} label={`UAT actual ${fmtDate(p.actualUat)}`} />
                <Diamond p={pos(parse(p.targetGolive))} color={COLORS.ink} soft label={`Go-Live target ${fmtDate(p.targetGolive)}`} />
                <Diamond p={pos(parse(p.actualGolive))} color={COLORS.ink} label={`Go-Live actual ${fmtDate(p.actualGolive)}`} />
                {/* today line */}
                {todayPos !== null && todayPos >= 0 && todayPos <= 100 && (
                  <span className="absolute top-0 z-[1] h-full w-[1.5px] bg-late" style={{ left: `${todayPos}%` }} title="วันนี้" />
                )}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, soft, label }: { color: string; soft?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <DiamondMark color={color} soft={soft} />
      {label}
    </span>
  );
}

// target = กรอบกลวง · actual = ทึบ
function DiamondMark({ color, soft }: { color: string; soft?: boolean }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rotate-45 border-[1.5px]"
      style={{ borderColor: color, backgroundColor: soft ? '#FFFFFF' : color }}
    />
  );
}

function Cell({ w, children, clip = true }: { w: string; children: React.ReactNode; clip?: boolean }) {
  return (
    <div className="flex items-center px-2 py-2.5" style={{ width: w }}>
      <div className={clip ? 'w-full truncate' : 'w-full'}>{children}</div>
    </div>
  );
}

function ProgressBar({ value, override }: { value: number | null; override: boolean }) {
  if (value === null) return <span className="text-xs text-ink-3">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand-700" style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-ink-2">
        {value}%{override && <span title="PM ปรับเอง"> ✎</span>}
      </span>
    </div>
  );
}

function Diamond({ p, color, soft, label }: { p: number | null; color: string; soft?: boolean; label: string }) {
  if (p === null || p < 0 || p > 100) return null;
  return (
    <span
      title={label}
      className="absolute top-1/2 z-[2] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-[1.5px]"
      style={{ left: `${p}%`, borderColor: color, backgroundColor: soft ? '#FFFFFF' : color }}
    />
  );
}
