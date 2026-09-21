import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPortfolio, getMilestones, getAttention, getTrend, runSyncNow, logout } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Portfolio, Milestone, AttentionItem, TrendResponse, ProjectStatus } from '../lib/types';
import { fmtDateTime, fmtDate, isStale } from '../lib/format';
import { statusColor, STATUS_LABEL } from '../lib/theme';
import KpiCard from '../components/KpiCard';
import GanttTimeline from '../components/GanttTimeline';
import DonutChart from '../components/DonutChart';
import TrendLine from '../components/TrendLine';
import FilterBar, { type Filters } from '../components/FilterBar';
import DrillDownPanel from '../components/DrillDownPanel';

export default function PM() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [filters, setFilters] = useState<Filters>({ status: '', projectCode: '', view: 'project' });
  const [asOf, setAsOf] = useState<string>(''); // req1: ดูย้อนหลัง ณ วันที่ (ว่าง = ปัจจุบัน)
  const [drill, setDrill] = useState<{ code: string; title: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadPortfolio = () =>
    getPortfolio({
      status: filters.status || undefined,
      projectCode: filters.projectCode || undefined,
      asOf: asOf || undefined,
    })
      .then(setPortfolio)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    loadPortfolio();
  }, [filters.status, filters.projectCode, asOf]);

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
    try {
      await runSyncNow();
      await loadPortfolio();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  if (err && !portfolio) return <div className="p-8 text-delayed">โหลดข้อมูลไม่ได้: {err} — backend รันอยู่ไหม (:3000)</div>;
  if (!portfolio) return <div className="p-8 text-slate-400">กำลังโหลด…</div>;

  const k = portfolio.kpis;
  const pctOf = (n: number) => (k.total ? ` (${Math.round((n / k.total) * 100)}%)` : '');
  const stale = isStale(portfolio.lastSyncAt);
  const codes = portfolio.projects.slice(0, 5).map((p) => p.code);

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Project Portfolio — Executive Summary</h1>
          <p className="text-xs text-slate-500">On Time · On Quality · On Business Value</p>
        </div>
        <div className="flex items-center gap-3 no-print">
          <label className="flex items-center gap-1 text-xs text-slate-500">
            ย้อนหลัง:
            <input
              type="date"
              value={asOf}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setAsOf(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-slate-800"
            />
            {asOf && (
              <button onClick={() => setAsOf('')} className="text-doing hover:underline">
                ปัจจุบัน
              </button>
            )}
          </label>
          <span className={`rounded px-2 py-1 text-xs ${stale ? 'bg-delayed text-white' : 'bg-slate-200 text-slate-600'}`}>
            ข้อมูล ณ {fmtDateTime(portfolio.lastSyncAt)}
            {stale && ' · เก่ากว่า 24 ชม.'}
          </span>
          <button onClick={doSync} disabled={syncing} className="rounded bg-doing px-3 py-1 text-sm text-white disabled:opacity-50">
            {syncing ? 'กำลัง Sync…' : 'Sync now'}
          </button>
          <Link to="/finance" className="text-sm text-doing hover:underline">
            การเงิน
          </Link>
          <Link to="/admin" className="text-sm text-doing hover:underline">
            Admin
          </Link>
          <UserMenu />
        </div>
      </div>

      {/* as-of banner (req1) */}
      {asOf && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm ring-1 ring-atrisk/40">
          {portfolio.asOfHasData ? (
            <>📅 ดูข้อมูลย้อนหลัง ณ <b>{fmtDate(asOf)}</b> (snapshot {fmtDate(portfolio.asOfSnapshot ?? null)}) · overdue ไม่มีในข้อมูลย้อนหลัง</>
          ) : (
            <>📅 <b>ยังไม่มี snapshot ก่อน {fmtDate(asOf)}</b> — ระบบเก็บ snapshot วันละครั้ง (17:00) เริ่มสะสมแล้ว</>
          )}
        </div>
      )}

      <FilterBar projects={portfolio.projects} filters={filters} onChange={setFilters} />

      {/* KPI 6 */}
      <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="โปรเจกต์ทั้งหมด" value={k.total} onClick={() => setFilters((f) => ({ ...f, status: '' }))} />
        <KpiCard label="On Track" value={`${k.onTrack}${pctOf(k.onTrack)}`} onClick={() => setFilters((f) => ({ ...f, status: 'ON_TRACK' }))} />
        <KpiCard label="At Risk" value={`${k.atRisk}${pctOf(k.atRisk)}`} tone="warn" onClick={() => setFilters((f) => ({ ...f, status: 'AT_RISK' }))} />
        <KpiCard label="Delayed" value={`${k.delayed}${pctOf(k.delayed)}`} tone="danger" onClick={() => setFilters((f) => ({ ...f, status: 'DELAYED' }))} />
        <KpiCard label="UAT เดือนนี้" value={k.uatThisMonth} />
        <KpiCard label="Go-Live เดือนนี้" value={k.goliveThisMonth} />
      </div>

      {/* BLOCK A — Gantt */}
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Project Timeline (Target vs Forecast)</h2>
        <GanttTimeline projects={portfolio.projects} onProjectClick={(code) => setDrill({ code, title: `การ์ดทั้งหมด` })} />
      </section>

      {/* B milestones · C donut · D attention */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Milestones ที่จะถึง">
          {milestones.length === 0 ? (
            <Empty text="ยังไม่มี UAT / Go-Live ข้างหน้า (หรือยังไม่ตั้งเป้า)" />
          ) : (
            <ul className="space-y-2 text-sm">
              {milestones.map((m, i) => {
                const urgent = m.inDays <= 7;
                const soon = m.inDays <= 14;
                return (
                  <li key={i} className="flex items-center justify-between">
                    <span>
                      <b>{m.displayName}</b> · {m.type === 'UAT' ? 'UAT' : 'Go-Live'}
                    </span>
                    <span className={urgent ? 'font-semibold text-delayed' : soon ? 'font-medium text-atrisk' : 'text-slate-500'}>
                      {fmtDate(m.date)} ({m.inDays} วัน)
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="สถานะโปรเจกต์">
          <DonutChart data={donutData} centerLabel="โปรเจกต์" />
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <Legend color={statusColor('ON_TRACK')} text="On Track = ตามแผน" />
            <Legend color={statusColor('AT_RISK')} text="At Risk = เสี่ยง (blocker/overdue/ใกล้ครบแต่ยังไม่ถึง 80%)" />
            <Legend color={statusColor('DELAYED')} text="Delayed = เลยกำหนด/forecast ช้ากว่า target" />
          </div>
        </Card>

        <Card title="ต้องตัดสินใจ (CEO Attention)">
          {attention.length === 0 ? (
            <Empty text="ไม่มีเรื่องค้างตัดสินใจ 🎉" />
          ) : (
            <ul className="space-y-2 text-sm">
              {attention.map((a) => (
                <li key={a.id} className="rounded border-l-2 border-atrisk bg-slate-50 px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <b className="text-xs text-slate-600">{a.project.projectCode}</b>
                    <span className="rounded bg-slate-200 px-1 text-[10px]">{a.source}</span>
                  </div>
                  <div>{a.title}</div>
                  <div className="text-xs text-delayed">{a.impactText}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* BLOCK E — trend */}
      <Card title="ความคืบหน้าย้อนหลัง">
        {trend && (
          <TrendLine series={trend.series} codes={codes} weeksCollected={trend.weeksCollected} needForFull={trend.needForFullTrend} />
        )}
      </Card>

      <DrillDownPanel
        open={!!drill}
        code={drill?.code ?? null}
        title={drill?.title ?? ''}
        filter={{}}
        onClose={() => setDrill(null)}
      />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h3 className="mb-2 text-sm font-semibold text-slate-600">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm text-slate-400">{text}</div>;
}

function UserMenu() {
  const { user } = useAuth();
  const doLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    window.location.reload();
  };
  return (
    <div className="flex items-center gap-2 border-l border-slate-300 pl-3 text-xs">
      <span className="text-slate-500">
        {user?.displayName ?? '—'} <span className="text-slate-300">·</span> {user?.role}
      </span>
      <button onClick={doLogout} className="text-slate-400 hover:text-delayed">ออก</button>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {text}
    </span>
  );
}
