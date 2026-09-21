import { useMemo } from 'react';
import type { ProjectRow } from '../lib/types';
import { COLORS } from '../lib/theme';
import { fmtDate, slipText } from '../lib/format';
import StatusBadge from './StatusBadge';

const DAY = 86400000;
const WEEK = 7 * DAY;

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
      const e = parse(p.forecastGolive) ?? parse(p.targetGolive);
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
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div style={{ minWidth: 520 + TRACK_MIN }}>
        {/* header */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
          <div className="sticky left-0 z-10 flex w-[520px] shrink-0 bg-slate-50">
            <Cell w="34px">#</Cell>
            <Cell w="150px">Project</Cell>
            <Cell w="110px">Progress</Cell>
            <Cell w="80px">Target</Cell>
            <Cell w="70px">Slip</Cell>
            <Cell w="76px">Status</Cell>
          </div>
          <div className="relative flex-1" style={{ minWidth: TRACK_MIN }}>
            {weeks.map((t, i) =>
              i % 2 === 0 ? (
                <span key={i} className="absolute top-1 -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(t)}%` }}>
                  {fmtDate(new Date(t).toISOString())}
                </span>
              ) : null
            )}
          </div>
        </div>

        {/* rows */}
        {projects.map((p, idx) => {
          const bStart = pos(parse(p.startDate));
          const bEnd = pos(parse(p.forecastGolive) ?? parse(p.targetGolive));
          const slip = slipText(p.slipDays);
          return (
            <div key={p.code} className="flex items-stretch border-b border-slate-100 hover:bg-slate-50">
              <div className="sticky left-0 z-10 flex w-[520px] shrink-0 items-center bg-white text-sm">
                <Cell w="34px">{idx + 1}</Cell>
                <Cell w="150px">
                  <button className="truncate text-left font-medium text-doing hover:underline" onClick={() => onProjectClick?.(p.code)}>
                    {p.displayName}
                  </button>
                </Cell>
                <Cell w="110px">
                  <ProgressBar value={p.progressPct} override={p.progressSource === 'OVERRIDE'} />
                </Cell>
                <Cell w="80px">
                  <span className="text-xs text-slate-500">{fmtDate(p.forecastGolive ?? p.targetGolive)}</span>
                </Cell>
                <Cell w="70px">
                  <span className={`text-xs ${slip.late ? 'font-semibold text-delayed' : 'text-slate-400'}`}>{slip.text}</span>
                </Cell>
                <Cell w="76px">
                  <StatusBadge status={p.status} source={p.statusSource} reasons={p.statusReasons} autoStatus={p.statusAuto} />
                </Cell>
              </div>

              {/* timeline track */}
              <div className="relative flex-1 py-4" style={{ minWidth: TRACK_MIN }}>
                {/* week gridlines */}
                {weeks.map((t, i) => (
                  <span key={i} className="absolute top-0 h-full w-px bg-slate-100" style={{ left: `${pos(t)}%` }} />
                ))}
                {/* project bar */}
                {bStart !== null && bEnd !== null && (
                  <div
                    className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded bg-doing/20"
                    style={{ left: `${bStart}%`, width: `${Math.max(bEnd - bStart, 0.5)}%` }}
                  />
                )}
                {/* diamonds */}
                <Diamond p={pos(parse(p.targetUat))} color={COLORS.ontrack} soft label={`UAT target ${fmtDate(p.targetUat)}`} />
                <Diamond p={pos(parse(p.actualUat))} color={COLORS.ontrack} label={`UAT actual ${fmtDate(p.actualUat)}`} />
                <Diamond p={pos(parse(p.targetGolive))} color={COLORS.doing} soft label={`Go-Live target ${fmtDate(p.targetGolive)}`} />
                <Diamond p={pos(parse(p.forecastGolive))} color={COLORS.doing} label={`Go-Live forecast ${fmtDate(p.forecastGolive)}`} />
                {/* today line */}
                {todayPos !== null && todayPos >= 0 && todayPos <= 100 && (
                  <span className="absolute top-0 h-full w-0.5 bg-delayed" style={{ left: `${todayPos}%` }} title="วันนี้" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Cell({ w, children }: { w: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center px-2 py-2" style={{ width: w }}>
      <div className="w-full truncate">{children}</div>
    </div>
  );
}

function ProgressBar({ value, override }: { value: number | null; override: boolean }) {
  if (value === null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-1">
      <div className="h-2 flex-1 overflow-hidden rounded bg-slate-200">
        <div className="h-full rounded bg-doing" style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-slate-600">
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
      className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-1 ring-white"
      style={{ left: `${p}%`, backgroundColor: color, opacity: soft ? 0.45 : 1 }}
    />
  );
}
