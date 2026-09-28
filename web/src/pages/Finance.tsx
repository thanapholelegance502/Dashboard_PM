import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getFinance } from '../lib/api';
import type { CashflowBucketKey, FinanceResult, ProjectStatus } from '../lib/types';
import { money, moneyShort, fmtDate } from '../lib/format';
import { statusColor, STATUS_LABEL } from '../lib/theme';
import { useAuth } from '../lib/auth';
import AppShell from '../components/AppShell';
import KpiCard from '../components/KpiCard';
import SectionCard, { EmptyState, ErrorBox } from '../components/SectionCard';
import InstallmentDrawer, { parseDrill, drillParams, type FinanceDrill } from '../components/InstallmentDrawer';

const TITLE = 'Portfolio Financial — Executive';
const EYEBROW = 'มูลค่างาน · การเก็บเงิน · กระแสเงินสด';
const TAGLINE = 'Deliver Projects. Create Business Value.';

export default function Finance() {
  const [data, setData] = useState<FinanceResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sp, setSp] = useSearchParams();
  const { user } = useAuth();

  const load = () => { setErr(null); getFinance().then(setData).catch((e) => setErr(e.message)); };
  useEffect(load, []); // drawer อ่านจาก data ก้อนเดิม — ห้าม refetch ตอนเปิด

  const drill = useMemo(() => parseDrill(sp), [sp]);
  // เปิด = push (Back ปิด drawer) · ปิด = replace (เปิดปิดรัว ๆ ไม่ถม history)
  // แก้เฉพาะ key ของ drill — param อื่นบน URL ต้องรอด
  const openDrill = useCallback((d: FinanceDrill) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('inst');
      for (const [k, v] of Object.entries(drillParams(d))) next.set(k, v);
      return next;
    });
  }, [setSp]);
  const closeDrill = useCallback(() => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('drill');
      next.delete('inst');
      return next;
    }, { replace: true });
  }, [setSp]);
  const canEdit = user?.role === 'ADMIN' || user?.role === 'PM';

  if (err) {
    return (
      <AppShell title={TITLE} eyebrow={EYEBROW} tagline={TAGLINE}>
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
        <p className="mt-3 text-sm text-ink-3">กำลังโหลด…</p>
      </AppShell>
    );
  }

  const t = data.totals;
  const cf = data.cashflow;
  const cfRows: Array<{ key: CashflowBucketKey; label: string; b: typeof cf.overdue; danger?: boolean }> = [
    { key: 'overdue', label: 'เลยกำหนดแล้ว', b: cf.overdue, danger: true },
    { key: 'd0_30', label: 'ภายใน 30 วัน', b: cf.d0_30 },
    { key: 'd31_60', label: '31 – 60 วัน', b: cf.d31_60 },
    { key: 'd61_90', label: '61 – 90 วัน', b: cf.d61_90 },
    { key: 'd90plus', label: 'เกิน 90 วัน', b: cf.d90plus },
  ];
  // งวดที่ไม่ระบุวันครบกำหนด — โผล่เฉพาะตอนมี ไม่งั้นแท่งบวกกันไม่เท่า KPI ค้างเก็บ
  if (cf.noDate.count > 0) cfRows.push({ key: 'noDate', label: 'ไม่ระบุวันครบกำหนด', b: cf.noDate });
  const cfMax = Math.max(1, ...cfRows.map((r) => r.b.amount));
  // list ที่กด กับ drawer ที่ไปถึง มาจาก array เดียวกัน (§12.2)
  const overdue = data.installments
    .filter((i) => i.bucket === 'overdue')
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));

  return (
    <AppShell title={TITLE} eyebrow={EYEBROW} asOf={fmtDate(data.asOf)} tagline={TAGLINE}>
      {/* hero numbers */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="มูลค่างานรวม" value={moneyShort(t.budget)} title={money(t.budget)} tone="neutral" />
        <KpiCard label="เก็บเงินแล้ว" value={moneyShort(t.billed)} title={money(t.billed)} sub={t.burnPct != null ? `${t.burnPct}% ของมูลค่างาน` : undefined} tone="info" />
        <KpiCard label="ค้างเก็บ" value={moneyShort(t.outstanding)} title={money(t.outstanding)} sub="ตั้งงวดแล้ว รอชำระ" tone="atrisk" />
        <KpiCard
          label="ยังไม่ตั้งงวด"
          value={moneyShort(t.unplanned)}
          title={money(t.unplanned)}
          sub={
            t.overPlannedCount > 0
              ? `${t.overPlannedCount} โครงการตั้งงวดเกินมูลค่างาน`
              : t.noBudgetCount > 0
                ? `${t.noBudgetCount} โครงการยังไม่ใส่มูลค่างาน`
                : 'มูลค่างาน − งวดที่ตั้ง'
          }
          tone="waiting"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* cash-flow */}
        <SectionCard title="กระแสเงินสดที่จะเข้า">
          <div className="flex flex-col gap-3.5">
            {cfRows.map((r) => (
              <button
                key={r.key}
                type="button"
                disabled={r.b.count === 0}
                onClick={() => openDrill({ kind: 'bucket', bucket: r.key })}
                aria-label={`${r.label} · ${r.b.count} งวด · ดูรายละเอียด`}
                className="group w-full text-left disabled:cursor-default"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={`${r.danger && r.b.amount > 0 ? 'font-medium text-late' : 'text-ink-2'} group-enabled:group-hover:underline`}>{r.label}</span>
                  <span className="tabular-nums" title={money(r.b.amount)}>
                    <span className={`font-semibold ${r.danger && r.b.amount > 0 ? 'text-late' : 'text-ink'}`}>{money(r.b.amount)}</span>
                    <span className="ml-2 text-xs text-ink-3">{r.b.count} งวด</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full transition-opacity ${r.danger ? 'bg-late' : 'bg-brand-700'} group-enabled:group-hover:opacity-80`}
                    style={{ width: `${(r.b.amount / cfMax) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* revenue at risk + overdue */}
        <SectionCard title="เงินที่เสี่ยง / ต้องตามเก็บ" flush>
          <div className="border-b border-hair px-[18px] py-4">
            <div className="text-[13px] text-ink-2">Revenue at risk · งวดผูกกับโครงการที่ล่าช้า</div>
            <div
              className={`mt-1 text-[32px] font-semibold leading-tight tracking-tight tabular-nums ${data.revenueAtRisk.amount > 0 ? 'text-late' : 'text-ink'}`}
              title={money(data.revenueAtRisk.amount)}
            >
              {moneyShort(data.revenueAtRisk.amount)}
            </div>
            <div className="text-xs text-ink-3">{data.revenueAtRisk.items.length} งวด</div>
          </div>
          <div className="px-[18px] pb-1 pt-3 text-xs font-medium text-ink-3">งวดเลยกำหนดชำระ</div>
          {overdue.length === 0 ? (
            <EmptyState text="ไม่มีงวดค้างเก็บ" />
          ) : (
            <ul>
              {overdue.map((i) => (
                <li key={i.id} className="border-b border-hair-2 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => openDrill({ kind: 'project', code: i.code, instId: i.id })}
                    className="flex w-full items-center justify-between gap-3 px-[18px] py-2.5 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="code text-ink-3">{i.code}</span> · {i.name}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">{money(i.amount)}</span>
                      <span className="ml-2 text-xs font-semibold text-late">เลย {i.overdueDays} วัน</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* table */}
      <SectionCard title="การเงินรายโครงการ" flush>
        <div className="overflow-x-auto px-[6px] pb-2">
          <table className="tbl min-w-[640px]">
            <thead>
              <tr>
                <th>โครงการ</th>
                <th>สถานะ</th>
                <th className="!text-right">มูลค่างาน</th>
                <th className="!text-right">เก็บแล้ว</th>
                <th className="!text-right">ค้างเก็บ</th>
                <th className="!text-right">burn</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr
                  key={p.code}
                  onClick={() => {
                    // ลากเลือกตัวเลขเพื่อ copy ไม่ใช่การกดดู — ปล่อยผ่าน
                    if (!window.getSelection()?.isCollapsed) return;
                    openDrill({ kind: 'project', code: p.code });
                  }}
                  className="cursor-pointer hover:bg-surface-2"
                >
                  <td>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openDrill({ kind: 'project', code: p.code }); }}
                      className="text-left font-medium hover:text-brand-700 hover:underline"
                    >
                      {p.displayName}
                    </button>
                  </td>
                  <td><StatusDot status={p.status} /></td>
                  <td className="text-right tabular-nums text-ink-2">{money(p.budget)}</td>
                  <td className="text-right tabular-nums text-ok">{money(p.billed)}</td>
                  <td className="text-right tabular-nums">{money(p.outstanding)}</td>
                  <td className="text-right tabular-nums text-ink-3">{p.burnPct != null ? `${p.burnPct}%` : '—'}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="!border-b-0 !border-t-2 !border-t-line" colSpan={2}>รวมทั้งหมด</td>
                <td className="!border-b-0 !border-t-2 !border-t-line text-right tabular-nums">{money(t.budget)}</td>
                <td className="!border-b-0 !border-t-2 !border-t-line text-right tabular-nums text-ok">{money(t.billed)}</td>
                <td className="!border-b-0 !border-t-2 !border-t-line text-right tabular-nums">{money(t.outstanding)}</td>
                <td className="!border-b-0 !border-t-2 !border-t-line text-right tabular-nums text-ink-2">{t.burnPct != null ? `${t.burnPct}%` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <InstallmentDrawer drill={drill} data={data} canEdit={canEdit} onClose={closeDrill} />
    </AppShell>
  );
}

function StatusDot({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor(status) }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
