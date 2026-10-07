import { useEffect, useState } from 'react';
import { getYokDashboard, refreshYok } from '../lib/api';
import type { YokDashboard, YokRowRef } from '../lib/types';
import { money, moneyShort, fmtDate, fmtDateTime } from '../lib/format';
import { useAuth } from '../lib/auth';
import AppShell from '../components/AppShell';
import KpiCard from '../components/KpiCard';
import SectionCard, { EmptyState, ErrorBox } from '../components/SectionCard';
import StageFunnel from '../components/StageFunnel';
import YokHealthBadge from '../components/YokHealthBadge';

const TITLE = 'Project Executive Dashboard';
const EYEBROW = 'stage · weekly update · การเงิน · MA';
const TAGLINE = 'Deliver Projects. Create Business Value.';

export default function Yok() {
  const [data, setData] = useState<YokDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const canRefresh = user?.role === 'ADMIN' || user?.role === 'PM';

  const load = () => { setErr(null); getYokDashboard().then(setData).catch((e) => setErr(e.message)); };
  useEffect(load, []);

  // กวาดใหม่ทันที ไม่ต้องรอ cron 09:00/17:00
  const doRefresh = async () => {
    setBusy(true);
    try {
      const r = await refreshYok();
      if (!r.ok) setErr(r.error ?? 'กวาดข้อมูลไม่สำเร็จ');
      else load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const refreshBtn = canRefresh ? (
    <button onClick={doRefresh} disabled={busy} className="btn-secondary no-print">
      {busy ? 'กำลังดึง…' : 'ดึงข้อมูลใหม่'}
    </button>
  ) : undefined;

  if (err) {
    return (
      <AppShell title={TITLE} eyebrow={EYEBROW} tagline={TAGLINE} actions={refreshBtn}>
        <div className="max-w-xl"><ErrorBox title={`โหลดไม่ได้: ${err}`} onRetry={load} /></div>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell title={TITLE} eyebrow={EYEBROW} tagline={TAGLINE}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card flex flex-col gap-2.5 p-4"><div className="skeleton h-3 w-2/3" /><div className="skeleton h-8 w-1/2" /></div>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-3">กำลังโหลดจาก Google Sheet…</p>
      </AppShell>
    );
  }

  const s = data.sections;
  const link = (r: YokRowRef) => `${data.sheetUrl}${r.gid != null ? `#gid=${r.gid}` : ''}`;
  const SheetLink = ({ r }: { r: YokRowRef }) => (
    <a href={link(r)} target="_blank" rel="noopener noreferrer" title="ต้องมีสิทธิ์เข้าถึงชีต"
       className="text-[13px] font-medium text-brand-700 hover:underline">แถว {r.row} ↗</a>
  );

  return (
    <AppShell title={TITLE} eyebrow={EYEBROW} asOf={fmtDateTime(data.asOf)} tagline={TAGLINE} actions={refreshBtn}>
      {/* ข้อมูลไม่สด / ไม่ครบ — ห้ามให้ "stale" อ่านเป็น "ปกติดี" */}
      {data.stale && (
        <div className="mb-4 rounded-lg bg-late-bg px-3.5 py-2.5 text-sm text-late">
          {data.staleReason ?? 'ดึงข้อมูลจาก Google ไม่สำเร็จ'} · แสดงข้อมูลเมื่อ {fmtDateTime(data.asOf)}
        </div>
      )}
      {s.overview.projectsIncomplete && (
        <div className="mb-4 rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
          ยังไม่ได้เชื่อมแท็บรายโครงการในชีต — รายชื่อด้านล่างรวมจากแท็บอื่น ส่วนขั้นตอน/สถานะยังว่าง
        </div>
      )}

      {/* ── Overview ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="โครงการทั้งหมด" value={s.overview.kpis.projects} tone="neutral" />
        <KpiCard label="เรื่องรอผู้บริหารตัดสิน" value={s.overview.kpis.openActions} tone="atrisk" problem={s.overview.kpis.openActions > 0} />
        <KpiCard label="งวดเลยกำหนดชำระ" value={s.overview.kpis.overdueInstallments} sub={money(s.billing.overdueAmount)} tone="delayed" problem={s.overview.kpis.overdueInstallments > 0} />
        <KpiCard label={`MA ใกล้หมดอายุ (${s.maTracking.expiringWithinDays} วัน)`} value={s.overview.kpis.maExpiring} tone="waiting" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="ขั้นตอนงาน">
          {s.overview.projectsIncomplete
            ? <EmptyState text="ยังไม่มีข้อมูลขั้นตอน" sub="ต้องเชื่อมแท็บรายโครงการก่อน" tone="muted" />
            : <StageFunnel data={s.overview.byStage} />}
        </SectionCard>

        <SectionCard title="เรื่องรอผู้บริหารตัดสิน" count={s.executiveAction.openCount} countTone="alert" flush>
          {s.executiveAction.items.length === 0 ? (
            <EmptyState text="ไม่มีเรื่องค้างตัดสินใจ" />
          ) : (
            <ul>
              {s.executiveAction.items.map((a) => (
                <li key={a.rowRef.row} className="flex items-center justify-between gap-3 border-b border-hair-2 px-[18px] py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0">
                    <span className="code text-ink-3">{a.projectId ?? '—'}</span> · {a.topic ?? '—'}
                    <span className="block text-xs text-ink-3">{a.owner ?? 'ยังไม่ระบุผู้ตัดสินใจ'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-xs tabular-nums ${a.overdueDays ? 'font-semibold text-late' : 'text-ink-2'}`}>
                      {a.done ? 'ปิดแล้ว' : a.overdueDays ? `เลย ${a.overdueDays} วัน` : fmtDate(a.neededBy)}
                    </span>
                    <SheetLink r={a.rowRef} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ── Weekly Update ── ‼️ หนึ่งแถวต่อสัปดาห์ ไม่ใช่ต่อโครงการ */}
      <SectionCard title="Weekly Update" right={<span>สรุปภาพรวมรายสัปดาห์</span>} className="mb-5" flush>
        {s.weeklyUpdate.items.length === 0 ? (
          <EmptyState text="ยังไม่มี weekly update" tone="muted" />
        ) : (
          <ul>
            {s.weeklyUpdate.items.map((w) => (
              <li key={w.rowRef.row} className="border-b border-hair-2 px-[18px] py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold">สัปดาห์ {fmtDate(w.weekStart)}</span>
                  <span className="ml-auto"><SheetLink r={w.rowRef} /></span>
                </div>
                {w.summary && <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{w.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ── Billing ── ‼️ คนละแหล่งกับหน้าการเงินของเรา ห้ามเอาไปบวกกัน */}
      <SectionCard
        title="การเงิน (จากชีตของหยก)"
        right={<span>คนละแหล่งกับหน้า “การเงิน” ของ Portal — ห้ามนำไปรวมกัน</span>}
        className="mb-5"
        flush
      >
        <div className="grid grid-cols-2 gap-3 px-[18px] pb-1 pt-3 lg:grid-cols-4">
          <KpiCard label="มูลค่างานรวม (ก่อน VAT)" value={moneyShort(s.billing.totals.exVat)} title={money(s.billing.totals.exVat)} tone="neutral" />
          <KpiCard label="รวม VAT" value={moneyShort(s.billing.totals.incVat)} title={money(s.billing.totals.incVat)} tone="info" />
          <KpiCard label="เก็บแล้ว" value={moneyShort(s.billing.totals.billed)} title={money(s.billing.totals.billed)} tone="ontrack" />
          <KpiCard label="ค้างเก็บ" value={moneyShort(s.billing.totals.outstanding)} title={money(s.billing.totals.outstanding)} tone="atrisk" problem={s.billing.totals.outstanding > 0} />
        </div>
        {s.billing.items.length === 0 ? (
          <EmptyState text="ยังไม่มีข้อมูลการเงิน" tone="muted" />
        ) : (
          <div className="overflow-x-auto px-[6px] pb-2">
            <table className="tbl min-w-[720px]">
              <thead>
                <tr><th>โครงการ</th><th className="!text-right">ก่อน VAT</th><th className="!text-right">รวม VAT</th><th className="!text-right">งวด</th><th className="!text-right">เก็บแล้ว</th><th className="!text-right">ค้างเก็บ</th><th className="!text-right">ที่มา</th></tr>
              </thead>
              <tbody>
                {s.billing.items.map((b) => (
                  <tr key={b.rowRef.row}>
                    <td><span className="code text-ink-3">{b.projectId ?? '—'}</span> {b.projectName ?? ''}</td>
                    <td className="text-right tabular-nums text-ink-2">{b.amountExVat == null ? '—' : money(b.amountExVat)}</td>
                    <td className="text-right tabular-nums">{b.amountIncVat == null ? '—' : money(b.amountIncVat)}</td>
                    <td className="text-right tabular-nums text-ink-3">{b.installments ?? '—'}</td>
                    <td className="text-right tabular-nums text-ok">{b.billed == null ? '—' : money(b.billed)}</td>
                    <td className={`text-right tabular-nums ${(b.outstanding ?? 0) > 0 ? 'font-medium' : 'text-ink-3'}`}>{b.outstanding == null ? '—' : money(b.outstanding)}</td>
                    <td className="text-right"><SheetLink r={b.rowRef} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── งวดชำระรายงวด ── */}
      <SectionCard title="งวดชำระ" count={s.billing.counts.overdueInstallments} countTone="alert" className="mb-5" flush>
        {s.billing.schedule.length === 0 ? (
          <EmptyState text="ยังไม่มีงวดชำระ" tone="muted" />
        ) : (
          <div className="overflow-x-auto px-[6px] pb-2">
            <table className="tbl min-w-[640px]">
              <thead>
                <tr><th>โครงการ</th><th className="!text-right">งวดที่</th><th className="!text-right">ยอดรวม VAT</th><th className="!text-right">กำหนดชำระ</th><th className="!text-right">สถานะ</th><th className="!text-right">ที่มา</th></tr>
              </thead>
              <tbody>
                {s.billing.schedule.map((x) => (
                  <tr key={x.rowRef.row}>
                    <td><span className="code text-ink-3">{x.projectId ?? '—'}</span></td>
                    <td className="text-right tabular-nums">{x.installmentNo ?? '—'}</td>
                    <td className="text-right tabular-nums">{x.amountIncVat == null ? '—' : money(x.amountIncVat)}</td>
                    <td className="text-right tabular-nums text-ink-2">{fmtDate(x.dueDate)}</td>
                    <td className="text-right text-xs">
                      {x.paid ? <span className="text-ok">✓ จ่ายแล้ว{x.paidDate ? ` ${fmtDate(x.paidDate)}` : ''}</span>
                        : x.overdueDays ? <span className="font-semibold text-late">เลย {x.overdueDays} วัน</span>
                        : <span className="text-ink-2">รอชำระ</span>}
                    </td>
                    <td className="text-right"><SheetLink r={x.rowRef} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ── MA Tracking ── */}
        <SectionCard title="MA Tracking" count={s.maTracking.expiredCount} countTone="alert" flush>
          {s.maTracking.items.length === 0 ? (
            <EmptyState text="ยังไม่มีสัญญา MA" tone="muted" />
          ) : (
            <ul>
              {s.maTracking.items.map((m) => (
                <li key={m.rowRef.row} className="flex items-center justify-between gap-3 border-b border-hair-2 px-[18px] py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0">
                    <span className="code text-ink-3">{m.projectId ?? '—'}</span> {m.projectName ?? ''}
                    <span className="block text-xs text-ink-3">
                      หมดอายุ {fmtDate(m.endDate)}{m.duration ? ` · ${m.duration}` : ''}{m.maType ? ` · ${m.maType}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-xs font-semibold tabular-nums ${m.daysLeft == null ? 'text-ink-3' : m.daysLeft < 0 ? 'text-late' : m.daysLeft <= s.maTracking.expiringWithinDays ? 'text-risk' : 'text-ink-2'}`}>
                      {m.daysLeft == null ? '—' : m.daysLeft < 0 ? `หมดแล้ว ${-m.daysLeft} วัน` : `เหลือ ${m.daysLeft} วัน`}
                    </span>
                    <SheetLink r={m.rowRef} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* ── Milestone + Pending Kickoff ── */}
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title="Milestone ที่จะถึง" flush>
            {s.projects.milestones.length === 0 ? (
              <EmptyState text="ยังไม่มี milestone" tone="muted" />
            ) : (
              <ul>
                {s.projects.milestones.map((m) => (
                  <li key={m.rowRef.row} className="flex items-center justify-between gap-3 border-b border-hair-2 px-[18px] py-2.5 text-sm last:border-b-0">
                    <span className="min-w-0"><span className="code text-ink-3">{m.projectId ?? '—'}</span> · {m.name ?? '—'}</span>
                    <span className="shrink-0 text-right">
                      <span className={`block text-xs font-semibold tabular-nums ${m.inDays != null && m.inDays <= 7 ? 'text-late' : 'text-ink-2'}`}>
                        {fmtDate(m.dueDate)}{m.inDays != null ? ` (${m.inDays} วัน)` : ''}
                      </span>
                      <SheetLink r={m.rowRef} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="รอ Kickoff" count={s.projects.pendingKickoff.length} flush>
            {s.projects.pendingKickoff.length === 0 ? (
              <EmptyState text="ไม่มีโครงการรอ kickoff" />
            ) : (
              <ul>
                {s.projects.pendingKickoff.map((p) => (
                  <li key={p.rowRef.row} className="flex items-center justify-between gap-3 border-b border-hair-2 px-[18px] py-2.5 text-sm last:border-b-0">
                    <span className="min-w-0">
                      <span className="text-sm">{p.projectName ?? '—'}</span>
                      {p.note && <span className="block text-xs text-ink-3">{p.note}</span>}
                    </span>
                    <span className="shrink-0 text-right"><SheetLink r={p.rowRef} /></span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Projects ── */}
      <SectionCard title="โครงการทั้งหมด" count={s.projects.items.length} flush>
        {s.projects.items.length === 0 ? (
          <EmptyState text="ยังไม่มีโครงการ" tone="muted" />
        ) : (
          <div className="overflow-x-auto px-[6px] pb-2">
            <table className="tbl min-w-[560px]">
              <thead>
                <tr><th>โครงการ</th><th>ขั้นตอน</th><th>สถานะ</th><th className="!text-right">พบใน</th></tr>
              </thead>
              <tbody>
                {s.projects.items.map((p) => (
                  <tr key={p.projectId}>
                    <td><span className="code text-ink-3">{p.projectId}</span> {p.projectName ?? ''}</td>
                    <td className="text-ink-2">{p.stage ?? '—'}</td>
                    <td><YokHealthBadge health={p.health} /></td>
                    <td className="text-right text-xs text-ink-3">{p.sources.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {data.warnings.length > 0 && (
        <p className="mt-4 text-xs text-ink-3">
          หมายเหตุข้อมูล: {data.warnings.map((w) => `${w.tab} (${w.kind})`).join(' · ')}
        </p>
      )}
    </AppShell>
  );
}
