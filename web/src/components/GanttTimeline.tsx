import { useMemo } from 'react';
import type { ProjectRow } from '../lib/types';
import { COLORS } from '../lib/theme';
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">
        <LegendItem color={COLORS.ontrack} soft label="UAT (Target)" />
        <LegendItem color={COLORS.ontrack} label="UAT (Actual)" />
        <LegendItem color={COLORS.doing} soft label="Go-Live (Target)" />
        <LegendItem color={COLORS.doing} label="Go-Live (Actual)" />
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-delayed" /> วันนี้</span>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: LEFT_W + TRACK_MIN }}>
        {/* header */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
          <div className="sticky left-0 z-10 flex shrink-0 bg-slate-50" style={{ width: LEFT_W }}>
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
          const bEnd = pos(parse(p.actualGolive) ?? parse(p.targetGolive));
          const late = p.slipDays != null && p.slipDays > 0 ? p.slipDays : null;
          return (
            <div key={p.code} className="flex items-stretch border-b border-slate-100 hover:bg-slate-50">
              <div className="sticky left-0 z-10 flex shrink-0 items-center bg-white text-sm" style={{ width: LEFT_W }}>
                <Cell w={px(COL.idx)}>{idx + 1}</Cell>
                <Cell w={px(COL.project)}>
                  <button className="truncate text-left font-medium text-doing hover:underline" onClick={() => onProjectClick?.(p.code)}>
                    {p.displayName}
                  </button>
                </Cell>
                <Cell w={px(COL.progress)}>
                  <ProgressBar value={p.progressPct} override={p.progressSource === 'OVERRIDE'} />
                </Cell>
                <Cell w={px(COL.target)}>
                  <span className="text-xs text-slate-600">{fmtDate(p.targetGolive)}</span>
                </Cell>
                <Cell w={px(COL.actual)}>
                  {/* live แล้ว = วันจริง (+N ถ้าช้า) · ยังไม่ live แต่เลย target = เลย N วัน */}
                  {p.actualGolive ? (
                    <span
                      className={`text-xs ${late ? 'font-semibold text-delayed' : 'text-slate-600'}`}
                      title={late ? `Go-Live ช้ากว่า target ${late} วัน` : undefined}
                    >
                      {fmtDate(p.actualGolive)}
                      {late && <span className="ml-1 text-[10px]">+{late}</span>}
                    </span>
                  ) : late ? (
                    <span className="text-xs font-semibold text-delayed">เลย {late} วัน</span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </Cell>
                <Cell w={px(COL.status)} clip={false}>
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
                <Diamond p={pos(parse(p.actualGolive))} color={COLORS.doing} label={`Go-Live actual ${fmtDate(p.actualGolive)}`} />
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
    </div>
  );
}

function LegendItem({ color, soft, label }: { color: string; soft?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[1px]" style={{ backgroundColor: color, opacity: soft ? 0.45 : 1 }} />
      {label}
    </span>
  );
}

function Cell({ w, children, clip = true }: { w: string; children: React.ReactNode; clip?: boolean }) {
  return (
    <div className="flex items-center px-2 py-2" style={{ width: w }}>
      <div className={clip ? 'w-full truncate' : 'w-full'}>{children}</div>
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
