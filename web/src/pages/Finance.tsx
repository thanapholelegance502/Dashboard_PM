import { useEffect, useState } from 'react';
import { getFinance } from '../lib/api';
import type { FinanceResult, ProjectStatus } from '../lib/types';
import { money } from '../lib/format';
import { statusColor, STATUS_LABEL } from '../lib/theme';
import AppShell from '../components/AppShell';

export default function Finance() {
  const [data, setData] = useState<FinanceResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getFinance().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="p-8 text-red-600">โหลดไม่ได้: {err}</div>;
  if (!data) return <div className="p-8 text-slate-400">กำลังโหลด…</div>;

  const t = data.totals;
  const cf = data.cashflow;
  const cfRows = [
    { label: 'เลยกำหนดแล้ว', b: cf.overdue, danger: true },
    { label: 'ภายใน 30 วัน', b: cf.d0_30 },
    { label: '31 – 60 วัน', b: cf.d31_60 },
    { label: '61 – 90 วัน', b: cf.d61_90 },
    { label: 'เกิน 90 วัน', b: cf.d90plus },
  ];
  const cfMax = Math.max(1, ...cfRows.map((r) => r.b.amount));

  return (
    <AppShell title="Portfolio Financial — Executive" eyebrow="มูลค่างาน · การเก็บเงิน · กระแสเงินสด" tagline="Deliver Projects. Create Business Value.">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {/* hero numbers — แถบเดียว คั่นด้วยเส้น */}
        <section className="grid grid-cols-2 gap-y-6 border-b border-slate-200 py-7 md:grid-cols-4 md:divide-x md:divide-slate-200">
          <Metric label="มูลค่างานรวม" value={money(t.budget)} />
          <Metric label="เก็บเงินแล้ว" value={money(t.billed)} sub={t.burnPct != null ? `${t.burnPct}% ของมูลค่างาน` : undefined} accent="emerald" pad />
          <Metric label="ค้างเก็บ" value={money(t.outstanding)} sub="ตั้งงวดแล้ว รอชำระ" accent="amber" pad />
          <Metric label="ยังไม่ตั้งงวด" value={money(t.unplanned)} sub="มูลค่างาน − งวดที่ตั้ง" pad />
        </section>

        <div className="grid grid-cols-1 gap-10 py-8 lg:grid-cols-2">
          {/* cash-flow */}
          <section>
            <SectionTitle>กระแสเงินสดที่จะเข้า</SectionTitle>
            <div className="mt-4 space-y-3">
              {cfRows.map((r) => (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className={r.danger ? 'text-red-600' : 'text-slate-600'}>{r.label}</span>
                    <span className="tabular-nums">
                      <span className={`font-semibold ${r.danger ? 'text-red-600' : 'text-slate-900'}`}>{money(r.b.amount)}</span>
                      <span className="ml-2 text-xs text-slate-400">{r.b.count} งวด</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${r.danger ? 'bg-red-500' : 'bg-slate-800'}`} style={{ width: `${(r.b.amount / cfMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* revenue at risk + overdue */}
          <section>
            <SectionTitle>เงินที่เสี่ยง / ต้องตามเก็บ</SectionTitle>
            <div className="mt-4">
              <div className="text-xs text-slate-500">Revenue at risk · งวดผูกกับโครงการที่ล่าช้า</div>
              <div className="mt-0.5 text-3xl font-semibold tabular-nums text-red-600">{money(data.revenueAtRisk.amount)}</div>
              <div className="text-xs text-slate-400">{data.revenueAtRisk.items.length} งวด</div>
            </div>
            <div className="mt-5">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">งวดเลยกำหนดชำระ</div>
              {data.overdueInstallments.length === 0 ? (
                <p className="text-sm text-slate-400">ไม่มีงวดค้างเก็บ</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.overdueInstallments.map((i, idx) => (
                    <li key={idx} className="flex items-center justify-between py-2 text-sm">
                      <span>
                        <span className="text-slate-400">{i.code}</span> · {i.name}
                      </span>
                      <span className="tabular-nums">
                        <span className="font-medium text-slate-900">{money(i.amount)}</span>
                        <span className="ml-2 text-xs text-red-600">เลย {i.overdueDays} วัน</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* table */}
        <section className="border-t border-slate-200 pt-8">
          <SectionTitle>การเงินรายโครงการ</SectionTitle>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="pb-2 text-left font-medium">โครงการ</th>
                <th className="pb-2 text-left font-medium">สถานะ</th>
                <th className="pb-2 text-right font-medium">มูลค่างาน</th>
                <th className="pb-2 text-right font-medium">เก็บแล้ว</th>
                <th className="pb-2 text-right font-medium">ค้างเก็บ</th>
                <th className="pb-2 text-right font-medium">burn</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.code} className="border-b border-slate-100">
                  <td className="py-2.5 font-medium text-slate-900">{p.displayName}</td>
                  <td className="py-2.5"><StatusDot status={p.status} /></td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">{money(p.budget)}</td>
                  <td className="py-2.5 text-right tabular-nums text-emerald-600">{money(p.billed)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-900">{money(p.outstanding)}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-400">{p.burnPct != null ? `${p.burnPct}%` : '—'}</td>
                </tr>
              ))}
              <tr className="text-sm font-semibold">
                <td className="pt-3" colSpan={2}>รวมทั้งหมด</td>
                <td className="pt-3 text-right tabular-nums text-slate-900">{money(t.budget)}</td>
                <td className="pt-3 text-right tabular-nums text-emerald-600">{money(t.billed)}</td>
                <td className="pt-3 text-right tabular-nums text-slate-900">{money(t.outstanding)}</td>
                <td className="pt-3 text-right tabular-nums text-slate-500">{t.burnPct != null ? `${t.burnPct}%` : '—'}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, sub, accent, pad }: { label: string; value: string; sub?: string; accent?: 'emerald' | 'amber'; pad?: boolean }) {
  const color = accent === 'emerald' ? 'text-emerald-600' : accent === 'amber' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className={pad ? 'md:pl-6' : ''}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums md:text-[26px] ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{children}</h2>;
}

function StatusDot({ status }: { status: ProjectStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor(status) }} />
      {STATUS_LABEL[status]}
    </span>
  );
}
