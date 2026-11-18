import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPortfolio, getMilestones, getAttention, getTrend, runSyncNow, downloadPmReport, listWeeklyReports, weeklyReportPdfUrl } from '../lib/api';
import type { Portfolio, Milestone, AttentionItem, TrendResponse, ProjectStatus, WeeklyArchiveItem } from '../lib/types';
import { fmtDateTime, fmtDate, isStale } from '../lib/format';
import { statusColor, STATUS_LABEL } from '../lib/theme';
import AppShell from '../components/AppShell';
import SectionCard, { EmptyState, SkeletonRows, ErrorBox } from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import GanttTimeline from '../components/GanttTimeline';
import DonutChart from '../components/DonutChart';
import TrendLine from '../components/TrendLine';
import FilterBar, { type Filters } from '../components/FilterBar';
import DrillDownPanel from '../components/DrillDownPanel';
import StatusBadge from '../components/StatusBadge';
import WeeklyNotesCard from '../components/WeeklyNotesCard';
import { useAuth } from '../lib/auth';

const TITLE = 'Project Portfolio — Executive Summary';
const EYEBROW = 'UAT · Go-Live · Timeline · Status';
const TAGLINE = 'Deliver Projects. Create Business Value.';
const DAY = 86400000;

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
  const [archives, setArchives] = useState<WeeklyArchiveItem[]>([]);
  const [showDone, setShowDone] = useState(false);
  const { user } = useAuth();
  // /finance ต้องมี board CLEVEL — ไม่มีก็อย่าเสนอลิงก์ที่กดแล้วเจอ 403
  const canSeeFinance = !!user?.boards?.includes('CLEVEL');

  const loadPortfolio = () =>
    getPortfolio({ status: filters.status || undefined, projectCode: filters.projectCode || undefined, asOf: asOf || undefined })
      .then((p) => { setPortfolio(p); setErr(null); })
      .catch((e) => setErr(e.message));

  const loadArchives = () => listWeeklyReports().then((r) => setArchives(r.items)).catch(() => {});
  useEffect(() => { loadPortfolio(); }, [filters.status, filters.projectCode, asOf]);
  useEffect(() => {
    getMilestones().then((r) => setMilestones(r.items)).catch(() => {});
    getAttention('OPEN').then((r) => setAttention(r.items)).catch(() => {});
    getTrend(12).then(setTrend).catch(() => {});
    loadArchives();
  }, []);

  const donutData = useMemo(() => {
    const rows = portfolio?.projects ?? [];
    const by: Record<string, number> = {};
    for (const p of rows) by[p.status] = (by[p.status] ?? 0) + 1;
    return (['WAITING', 'ON_TRACK', 'AT_RISK', 'DELAYED', 'DONE'] as ProjectStatus[])
      .filter((s) => by[s])
      .map((s) => ({ name: STATUS_LABEL[s], value: by[s], color: statusColor(s), onClick: () => setFilters((f) => ({ ...f, status: s })) }));
  }, [portfolio]);

  // เรียงตามวันที่ต้องได้คำตอบ (ไม่มีวัน = ท้ายสุด)
  const attentionSorted = useMemo(
    () => [...attention].sort((a, b) => (a.neededBy ?? '9999').localeCompare(b.neededBy ?? '9999')),
    [attention],
  );

  const doSync = async () => {
    setSyncing(true);
    try { await runSyncNow(); await loadPortfolio(); } catch (e) { setErr((e as Error).message); } finally { setSyncing(false); }
  };

  const syncBtn = (
    <button onClick={doSync} disabled={syncing} className="btn-primary no-print">
      {syncing ? 'กำลัง Sync…' : 'Sync now'}
    </button>
  );
  // PDF ตัวเดียวกับที่ส่งเมลทุกศุกร์ — ทั้ง portfolio ปัจจุบันเสมอ (ไม่สน filter)
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const doPdf = async () => {
    setPdfBusy(true);
    setPdfErr(null);
    try { await downloadPmReport(); } catch (e) { setPdfErr((e as Error).message); } finally { setPdfBusy(false); }
  };
  const printBtn = (
    <button
      onClick={doPdf}
      disabled={pdfBusy || !!asOf}
      title={asOf ? 'PDF ใช้ข้อมูลปัจจุบันเท่านั้น — ล้างวันที่ย้อนหลังก่อน' : 'ดาวน์โหลดสรุปเป็น PDF (ไฟล์เดียวกับที่ส่งเมลทุกศุกร์)'}
      className="btn-secondary no-print"
    >
      {pdfBusy ? 'กำลังสร้าง PDF…' : 'ดาวน์โหลด PDF'}
    </button>
  );

  if (err && !portfolio) {
    return (
      <AppShell title={TITLE} eyebrow={EYEBROW} tagline={TAGLINE}>
        <div className="max-w-xl">
          <ErrorBox title={`โหลดข้อมูลไม่ได้: ${err} — backend รันอยู่ไหม (:3000)`} onRetry={loadPortfolio} />
        </div>
      </AppShell>
    );
  }
  if (!portfolio) {
    return (
      <AppShell title={TITLE} eyebrow={EYEBROW} tagline={TAGLINE}>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="card flex flex-col gap-2.5 p-4"><div className="skeleton h-3 w-2/3" /><div className="skeleton h-8 w-1/3" /></div>
          ))}
        </div>
        <SectionCard title="CEO Attention Required"><SkeletonRows /></SectionCard>
        <p className="mt-3 text-sm text-ink-3">กำลังโหลด…</p>
      </AppShell>
    );
  }

  const k = portfolio.kpis;
  const pctOf = (n: number) => (k.total ? `${Math.round((n / k.total) * 100)}%` : '');
  const stale = isStale(portfolio.lastSyncAt);
  const codes = portfolio.projects.slice(0, 5).map((p) => p.code);
  const openDrill = (code: string) => setDrill({ code, title: 'การ์ดทั้งหมด' });
  // แยกงานเสร็จออกจาก timeline หลัก (projects มาเรียง sortByPain แล้ว · KPI/donut ยังนับ Done)
  const activeProjects = portfolio.projects.filter((p) => p.status !== 'DONE');
  const doneProjects = portfolio.projects.filter((p) => p.status === 'DONE');

  return (
    <AppShell
      title={TITLE}
      eyebrow={EYEBROW}
      asOf={fmtDateTime(portfolio.lastSyncAt)}
      stale={stale}
      tagline={TAGLINE}
      actions={<>{printBtn}{syncBtn}</>}
    >
      {pdfErr && <div className="no-print mb-5 max-w-xl"><ErrorBox title={`สร้าง PDF ไม่ได้: ${pdfErr}`} onRetry={doPdf} /></div>}
      {/* toolbar */}
      <div className="card no-print mb-5 flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
        <FilterBar projects={portfolio.projects} filters={filters} onChange={setFilters} />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          ย้อนหลัง:
          <input type="date" value={asOf} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setAsOf(e.target.value)}
            className="field-input py-1" />
          {asOf && <button onClick={() => setAsOf('')} className="btn-ghost btn-sm">ปัจจุบัน</button>}
        </label>
      </div>

      {asOf && (
        <div className="mb-5 rounded-lg border border-risk-bd bg-risk-bg px-3.5 py-2.5 text-sm text-[#5C4A1A]">
          {portfolio.asOfHasData
            ? <>ดูข้อมูลย้อนหลัง ณ <b>{fmtDate(asOf)}</b> (snapshot {fmtDate(portfolio.asOfSnapshot ?? null)}) · overdue ไม่มีในข้อมูลย้อนหลัง</>
            : <><b>ยังไม่มี snapshot ก่อน {fmtDate(asOf)}</b> — ระบบเก็บ snapshot วันละครั้ง (17:00) เริ่มสะสมแล้ว</>}
        </div>
      )}

      {/* KPI */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="โครงการทั้งหมด" value={k.total} tone="neutral" onClick={() => setFilters((f) => ({ ...f, status: '' }))} />
        <KpiCard label="UAT เดือนนี้" value={k.uatThisMonth} tone="info" sub="Milestones ที่จะถึง ↓" />
        <KpiCard label="Go-Live เดือนนี้" value={k.goliveThisMonth} tone="info" sub="Milestones ที่จะถึง ↓" />
        <KpiCard label="On Track" value={k.onTrack} sub={pctOf(k.onTrack)} tone="ontrack" onClick={() => setFilters((f) => ({ ...f, status: 'ON_TRACK' }))} />
        <KpiCard label="At Risk" value={k.atRisk} sub={pctOf(k.atRisk)} tone="atrisk" onClick={() => setFilters((f) => ({ ...f, status: 'AT_RISK' }))} />
        <KpiCard label="Delayed" value={k.delayed} sub={pctOf(k.delayed)} tone="delayed" problem={k.delayed > 0} onClick={() => setFilters((f) => ({ ...f, status: 'DELAYED' }))} />
        <KpiCard label="Waiting" value={k.waiting} sub={k.waiting ? `${pctOf(k.waiting)} · รอเริ่ม` : 'รอเริ่ม'} tone="waiting" onClick={() => setFilters((f) => ({ ...f, status: 'WAITING' }))} />
      </div>

      {/* CEO Attention | Milestones + Status */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <SectionCard title="CEO Attention Required" count={attention.length} countTone="alert" right="เรียงตามวันที่ต้องได้คำตอบ" flush>
          {attentionSorted.length === 0 ? (
            <EmptyState text="ไม่มีเรื่องค้างตัดสินใจ" />
          ) : (
            <ul>
              {attentionSorted.map((a) => {
                const soon = a.neededBy ? new Date(a.neededBy).getTime() - Date.now() < 3 * DAY : false;
                return (
                  <li key={a.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-hair-2 px-[18px] py-3 last:border-b-0 hover:bg-[#FAF9F6] sm:grid-cols-[72px_minmax(0,1fr)_104px_72px] sm:items-center">
                    <span className="code pt-0.5 sm:pt-0">{a.project.projectCode}</span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium">{a.title}</span>
                      {a.impactText && <span className="text-xs text-late">{a.impactText}</span>}
                      <span className="flex items-center gap-1.5 text-xs text-ink-3">
                        <span className="rounded bg-surface-2 px-1.5 py-px text-[10px] font-semibold tracking-wide text-ink-2">{a.source}</span>
                        {a.issueType}
                      </span>
                    </div>
                    <div className="col-start-2 flex gap-1.5 text-xs sm:col-start-auto sm:flex-col sm:gap-0.5">
                      <span className="text-ink-3">ต้องการภายใน</span>
                      <span className={`font-semibold tabular-nums ${soon ? 'text-late' : 'text-ink'}`}>{fmtDate(a.neededBy)}</span>
                    </div>
                    {a.autoKey === 'PAYMENT_OVERDUE' && canSeeFinance ? (
                      // เรื่องเงิน → พาไปดูงวดจริง ไม่ใช่การ์ด Lark (§12.1 ไล่กลับไปหาที่มาได้)
                      <Link to={`/finance?drill=p:${a.project.projectCode}`} className="col-start-2 justify-self-start text-[13px] font-medium text-brand-700 hover:underline sm:col-start-auto sm:justify-self-end">
                        ดูงวด →
                      </Link>
                    ) : (
                      <button onClick={() => openDrill(a.project.projectCode)} className="col-start-2 justify-self-start text-[13px] font-medium text-brand-700 hover:underline sm:col-start-auto sm:justify-self-end">
                        ดูการ์ด →
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title="Milestones ที่จะถึง" flush>
            {milestones.length === 0 ? (
              <EmptyState text="ยังไม่มี UAT / Go-Live ข้างหน้า" tone="muted" />
            ) : (
              <ul>
                {milestones.map((m, i) => {
                  const cls = m.inDays <= 7 ? 'font-semibold text-late' : m.inDays <= 14 ? 'font-medium text-risk' : 'text-ink-2';
                  return (
                    <li key={i} className="flex items-center justify-between gap-3 border-b border-hair-2 px-[18px] py-2.5 text-sm last:border-b-0">
                      <span className="min-w-0 truncate"><b className="font-semibold">{m.displayName}</b> <span className="text-ink-3">·</span> {m.type === 'UAT' ? 'UAT' : 'Go-Live'}</span>
                      <span className={`shrink-0 tabular-nums ${cls}`}>{fmtDate(m.date)} ({m.inDays} วัน)</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Projects by Status">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
              <DonutChart data={donutData} centerLabel="โครงการ" />
              <div className="flex w-full min-w-0 flex-col gap-1.5 text-[13px]">
                <Legend status="ON_TRACK" text="On Track — ตามแผน" n={donutCount(donutData, 'ON_TRACK')} />
                <Legend status="AT_RISK" text="At Risk — เสี่ยง (blocker/overdue/ใกล้ครบ<80%)" n={donutCount(donutData, 'AT_RISK')} />
                <Legend status="DELAYED" text="Delayed — เลยกำหนด target Go-Live" n={donutCount(donutData, 'DELAYED')} />
                <Legend status="WAITING" text="Waiting — รอเริ่ม (PM ตั้ง)" n={donutCount(donutData, 'WAITING')} />
                <Legend status="DONE" text="Done" n={donutCount(donutData, 'DONE')} />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Gantt — ไม่รวมงานเสร็จ (ดูในหัวข้อ "โครงการที่เสร็จแล้ว") */}
      <div className="mb-5">
        <SectionCard title="Project Timeline (Target vs Actual)" flush>
          {activeProjects.length === 0
            ? <EmptyState text="ไม่มีโครงการที่กำลังดำเนินการ" tone="muted" />
            : <GanttTimeline projects={activeProjects} onProjectClick={openDrill} />}
        </SectionCard>
      </div>

      {/* โครงการที่เสร็จแล้ว — พับเก็บได้ */}
      {doneProjects.length > 0 && (
        <div className="mb-5">
          <SectionCard
            title={`โครงการที่เสร็จแล้ว (${doneProjects.length})`}
            right={<button onClick={() => setShowDone((v) => !v)} className="btn-ghost btn-sm">{showDone ? 'ซ่อน' : 'แสดง'}</button>}
            flush
          >
            {showDone && (
              <ul>
                {doneProjects.map((p) => (
                  <li key={p.code} className="flex items-center justify-between gap-3 border-b border-hair-2 px-[18px] py-2.5 text-sm last:border-b-0 hover:bg-[#FAF9F6]">
                    <button onClick={() => openDrill(p.code)} className="min-w-0 truncate text-left font-medium text-brand-700 hover:underline">{p.displayName}</button>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-ink-2">
                      <span className="tabular-nums">Go-Live {fmtDate(p.actualGolive ?? p.targetGolive)}</span>
                      <StatusBadge status={p.status} source={p.statusSource} reasons={p.statusReasons} autoStatus={p.statusAuto} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {/* บันทึกประจำสัปดาห์ (ลง PDF) + รายงานย้อนหลัง */}
      <div className="mb-5">
        <WeeklyNotesCard onClosed={loadArchives} />
      </div>
      <div className="mb-5">
        <SectionCard title="รายงานย้อนหลัง" count={archives.length} flush>
          {archives.length === 0
            ? <EmptyState text="ยังไม่มีรายงานที่ปิดสัปดาห์" sub="กด “ปิดสัปดาห์ตอนนี้” หรือรอ cron ศุกร์ 17:30" tone="muted" />
            : (
              <ul>
                {archives.map((a) => (
                  <li key={a.weekKey} className="flex items-center justify-between gap-3 border-b border-hair-2 px-[18px] py-2.5 text-sm last:border-b-0 hover:bg-[#FAF9F6]">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{a.weekKey}</span>
                      <span className="text-xs text-ink-3">ปิดเมื่อ {fmtDateTime(a.generatedAt)}</span>
                    </span>
                    <a href={weeklyReportPdfUrl(a.weekKey)} target="_blank" rel="noreferrer" className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline">
                      โหลด PDF →
                    </a>
                  </li>
                ))}
              </ul>
            )}
        </SectionCard>
      </div>

      {/* Trend */}
      <SectionCard title="ความคืบหน้าย้อนหลัง" right={trend && trend.weeksCollected >= trend.needForFullTrend ? `% progress · ${trend.needForFullTrend} สัปดาห์ · 5 โครงการแรก` : undefined}>
        {trend ? <TrendLine series={trend.series} codes={codes} weeksCollected={trend.weeksCollected} needForFull={trend.needForFullTrend} /> : <SkeletonRows />}
      </SectionCard>

      <DrillDownPanel open={!!drill} code={drill?.code ?? null} title={drill?.title ?? ''} filter={{}} onClose={() => setDrill(null)} />
    </AppShell>
  );
}

function donutCount(data: { name: string; value: number }[], s: ProjectStatus) {
  return data.find((d) => d.name === STATUS_LABEL[s])?.value ?? 0;
}

function Legend({ status, text, n }: { status: ProjectStatus; text: string; n: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor(status) }} />
      <span className="min-w-0 text-ink-2">{text}</span>
      <span className="ml-auto font-semibold tabular-nums">{n}</span>
    </span>
  );
}
