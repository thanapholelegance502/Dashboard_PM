import { useEffect, useMemo, useState } from 'react';
import { getPortfolio, getMilestones, getAttention, getTrend, runSyncNow } from '../lib/api';
import type { Portfolio, Milestone, AttentionItem, TrendResponse, ProjectStatus } from '../lib/types';
import { fmtDateTime, fmtDate, isStale } from '../lib/format';
import { statusColor, STATUS_LABEL } from '../lib/theme';
import AppShell from '../components/AppShell';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import GanttTimeline from '../components/GanttTimeline';
import DonutChart from '../components/DonutChart';
import TrendLine from '../components/TrendLine';
import FilterBar, { type Filters } from '../components/FilterBar';
import DrillDownPanel from '../components/DrillDownPanel';
import { IconLayers, IconCalendar, IconRocket, IconCheck, IconWarn, IconAlert, IconChart, IconFlag } from '../components/Icons';

export default function PM() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [filters, setFilters] = useState<Filters>({ status: '', projectCode: '', view: 'project' });
  const [asOf, setAsOf] = useState<string>('');
  const [drill, setDrill] = useState<{ code: string; title: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadPortfolio = () =>
    getPortfolio({ status: filters.status || undefined, projectCode: filters.projectCode || undefined, asOf: asOf || undefined })
      .then(setPortfolio)
      .catch((e) => setErr(e.message));

  useEffect(() => { loadPortfolio(); }, [filters.status, filters.projectCode, asOf]);
  useEffect(() => {
    getMilestones().then((r) => setMilestones(r.items)).catch(() => {});
    getAttention('OPEN').then((r) => setAttention(r.items)).catch(() => {});
    getTrend(12).then(setTrend).catch(() => {});
  }, []);

  const donutData = useMemo(() => {
    const rows = portfolio?.projects ?? [];
    const by: Record<string, number> = {};
    for (const p of rows) by[p.status] = (by[p.status] ?? 0) + 1;
    return (['ON_TRACK', 'AT_RISK', 'DELAYED', 'DONE'] as ProjectStatus[])
      .filter((s) => by[s])
      .map((s) => ({ name: STATUS_LABEL[s], value: by[s], color: statusColor(s), onClick: () => setFilters((f) => ({ ...f, status: s })) }));
  }, [portfolio]);

  const doSync = async () => {
    setSyncing(true);
    try { await runSyncNow(); await loadPortfolio(); } catch (e) { setErr((e as Error).message); } finally { setSyncing(false); }
  };

  if (err && !portfolio) return <div className="p-8 text-red-600">โหลดข้อมูลไม่ได้: {err} — backend รันอยู่ไหม (:3000)</div>;
  if (!portfolio) return <div className="p-8 text-slate-400">กำลังโหลด…</div>;

  const k = portfolio.kpis;
  const pctOf = (n: number) => (k.total ? `${Math.round((n / k.total) * 100)}%` : '');
  const stale = isStale(portfolio.lastSyncAt);
  const codes = portfolio.projects.slice(0, 5).map((p) => p.code);

  return (
    <AppShell
      title="Project Portfolio — Executive Summary"
      eyebrow="UAT · Go-Live · Timeline · Status"
      asOf={fmtDateTime(portfolio.lastSyncAt)}
      tagline="Deliver Projects. Create Business Value."
    >
      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterBar projects={portfolio.projects} filters={filters} onChange={setFilters} />
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1 text-slate-500">
            ย้อนหลัง:
            <input type="date" value={asOf} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setAsOf(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-slate-800" />
            {asOf && <button onClick={() => setAsOf('')} className="text-doing hover:underline">ปัจจุบัน</button>}
          </label>
          {stale && <span className="rounded bg-red-600 px-2 py-1 text-white">ข้อมูลเก่ากว่า 24 ชม.</span>}
          <button onClick={doSync} disabled={syncing} className="rounded bg-doing px-3 py-1.5 font-medium text-white disabled:opacity-50">
            {syncing ? 'กำลัง Sync…' : 'Sync now'}
          </button>
        </div>
      </div>

      {asOf && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm ring-1 ring-amber-100">
          {portfolio.asOfHasData
            ? <>ดูข้อมูลย้อนหลัง ณ <b>{fmtDate(asOf)}</b> (snapshot {fmtDate(portfolio.asOfSnapshot ?? null)}) · overdue ไม่มีในข้อมูลย้อนหลัง</>
            : <><b>ยังไม่มี snapshot ก่อน {fmtDate(asOf)}</b> — ระบบเก็บ snapshot วันละครั้ง (17:00) เริ่มสะสมแล้ว</>}
        </div>
      )}

      {/* KPI 6 */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="โครงการทั้งหมด" value={k.total} tone="info" icon={<IconLayers />} onClick={() => setFilters((f) => ({ ...f, status: '' }))} />
        <KpiCard label="UAT เดือนนี้" value={k.uatThisMonth} tone="info" icon={<IconCalendar />} />
        <KpiCard label="Go-Live เดือนนี้" value={k.goliveThisMonth} tone="info" icon={<IconRocket />} />
        <KpiCard label="On Track" value={k.onTrack} sub={pctOf(k.onTrack)} tone="ontrack" icon={<IconCheck />} onClick={() => setFilters((f) => ({ ...f, status: 'ON_TRACK' }))} />
        <KpiCard label="At Risk" value={k.atRisk} sub={pctOf(k.atRisk)} tone="atrisk" icon={<IconWarn />} onClick={() => setFilters((f) => ({ ...f, status: 'AT_RISK' }))} />
        <KpiCard label="Delayed" value={k.delayed} sub={pctOf(k.delayed)} tone="delayed" icon={<IconAlert />} onClick={() => setFilters((f) => ({ ...f, status: 'DELAYED' }))} />
      </div>

      {/* Gantt */}
      <div className="mb-5">
        <SectionCard title="Project Timeline (Target vs Forecast)" icon={<IconChart />} className="!p-0">
          <GanttTimeline projects={portfolio.projects} onProjectClick={(code) => setDrill({ code, title: 'การ์ดทั้งหมด' })} />
        </SectionCard>
      </div>

      {/* 3 columns */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="Milestones ที่จะถึง" icon={<IconCalendar />}>
          {milestones.length === 0 ? (
            <Empty text="ยังไม่มี UAT / Go-Live ข้างหน้า" />
          ) : (
            <ul className="space-y-2 text-sm">
              {milestones.map((m, i) => {
                const cls = m.inDays <= 7 ? 'font-semibold text-delayed' : m.inDays <= 14 ? 'font-medium text-atrisk' : 'text-slate-500';
                return (
                  <li key={i} className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0">
                    <span><b>{m.displayName}</b> · {m.type === 'UAT' ? 'UAT' : 'Go-Live'}</span>
                    <span className={cls}>{fmtDate(m.date)} ({m.inDays} วัน)</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Projects by Status" icon={<IconFlag />}>
          <DonutChart data={donutData} centerLabel="โครงการ" />
          <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
            <Legend color={statusColor('ON_TRACK')} text="On Track — ตามแผน" />
            <Legend color={statusColor('AT_RISK')} text="At Risk — เสี่ยง (blocker/overdue/ใกล้ครบ<80%)" />
            <Legend color={statusColor('DELAYED')} text="Delayed — เลยกำหนด/forecast ช้ากว่า target" />
          </div>
        </SectionCard>

        <SectionCard title="CEO Attention Required" icon={<IconAlert />} tone="alert">
          {attention.length === 0 ? (
            <Empty text="ไม่มีเรื่องค้างตัดสินใจ" />
          ) : (
            <ul className="space-y-2 text-sm">
              {attention.map((a) => (
                <li key={a.id} className="rounded-lg bg-white/70 px-2.5 py-2 ring-1 ring-red-100">
                  <div className="flex items-center justify-between">
                    <b className="text-xs text-slate-600">{a.project.projectCode}</b>
                    <span className="rounded bg-slate-100 px-1.5 text-[10px] text-slate-500">{a.source}</span>
                  </div>
                  <div className="text-slate-800">{a.title}</div>
                  <div className="text-xs text-delayed">{a.impactText}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Trend */}
      <SectionCard title="ความคืบหน้าย้อนหลัง" icon={<IconChart />}>
        {trend && <TrendLine series={trend.series} codes={codes} weeksCollected={trend.weeksCollected} needForFull={trend.needForFullTrend} />}
      </SectionCard>

      <DrillDownPanel open={!!drill} code={drill?.code ?? null} title={drill?.title ?? ''} filter={{}} onClose={() => setDrill(null)} />
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-slate-400">{text}</div>;
}
function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {text}
    </span>
  );
}
