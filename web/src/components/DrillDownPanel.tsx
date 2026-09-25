import { useEffect, useState } from 'react';
import { getDrilldown, getBudget } from '../lib/api';
import type { DrilldownResult, BudgetResult } from '../lib/types';
import { fmtDate, money } from '../lib/format';
import { SkeletonRows, ErrorBox } from './SectionCard';

export interface DrillFilter {
  dept?: string;
  bucket?: string;
  overdue?: string;
}

interface Props {
  open: boolean;
  code: string | null;
  title: string;
  filter: DrillFilter;
  onClose: () => void;
}

export default function DrillDownPanel({ open, code, title, filter, onClose }: Props) {
  const [data, setData] = useState<DrilldownResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // filter ในหน้า detail (client-side) — req3: คลิก stage/dept/section กรองได้
  const [fDept, setFDept] = useState<string | null>(null);
  const [fBucket, setFBucket] = useState<string | null>(null);
  const [fSection, setFSection] = useState<string | null>(null);
  const [budget, setBudget] = useState<BudgetResult | null>(null);

  useEffect(() => {
    if (!open || !code) return;
    setLoading(true);
    setErr(null);
    setData(null);
    setBudget(null);
    setFDept(null);
    setFBucket(null);
    setFSection(null);
    getDrilldown(code, filter)
      .then(setData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
    getBudget(code).then(setBudget).catch(() => {});
  }, [open, code, JSON.stringify(filter)]);

  if (!open) return null;

  const allItems = data?.items ?? [];
  const filtered = allItems.filter(
    (t) =>
      (!fDept || t.deptCode === fDept) &&
      (!fBucket || t.bucketCode === fBucket) &&
      (!fSection || t.sectionName === fSection)
  );
  const hasFilter = !!(fDept || fBucket || fSection);
  // bucket counts จาก items (byDept/bySection มาจาก backend แล้ว)
  const byBucket: Record<string, number> = {};
  for (const t of allItems) byBucket[t.bucketCode] = (byBucket[t.bucketCode] ?? 0) + 1;
  const toggle = (cur: string | null, v: string, set: (x: string | null) => void) => set(cur === v ? null : v);

  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 transition ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-surface text-ink-2 hover:border-brand-700'}`;

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-[rgba(22,38,63,0.18)]" onClick={onClose} />
      <div className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-panel">
        <div className="flex flex-col gap-1.5 border-b border-hair px-[22px] pb-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="code text-ink-3">{code}</span>
            <button onClick={onClose} aria-label="ปิด" className="ml-auto flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-sm text-ink-2 hover:text-ink">
              ✕
            </button>
          </div>
          <div className="flex items-baseline gap-2.5">
            <h3 className="text-xl font-semibold">{title}</h3>
            <span className="text-[28px] font-semibold leading-none tabular-nums">
              {data ? (hasFilter ? `${filtered.length}/${data.total}` : data.total) : ''}
            </span>
            {data && <span className="text-sm text-ink-3">ใบ</span>}
          </div>
          <span className="text-xs text-ink-3">หลักฐานจาก Lark Task · คลิก "เปิดใน Lark" เพื่อดูการ์ดจริง</span>
        </div>

        {loading && <div className="p-[22px]"><SkeletonRows rows={5} /></div>}
        {err && <div className="p-[22px]"><ErrorBox title={`ผิดพลาด: ${err}`} /></div>}

        {data && (
          <div className="flex-1 overflow-y-auto px-[22px] py-4">
            {/* budget + งวดการเงิน (req2) */}
            {budget && (budget.budget != null || budget.installments.length > 0) && (
              <div className="mb-4 rounded-xl border border-line bg-canvas p-3.5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">งบประมาณ</span>
                  <span className="tabular-nums text-ink-2">
                    จ่ายแล้ว <b className="text-ink">{money(budget.paid)}</b> / {money(budget.budget)}
                    {budget.burnPct != null && <span className="ml-1 text-ink-3">({budget.burnPct}%)</span>}
                  </span>
                </div>
                {budget.budget != null && budget.budget > 0 && (
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${(budget.burnPct ?? 0) > 100 ? 'bg-late' : 'bg-brand-700'}`}
                      style={{ width: `${Math.min(budget.burnPct ?? 0, 100)}%` }}
                    />
                  </div>
                )}
                {budget.installments.length > 0 && (
                  <table className="w-full text-xs">
                    <tbody>
                      {budget.installments.map((it) => (
                        <tr key={it.id} className="border-t border-hair">
                          <td className="py-1.5">{it.name}</td>
                          <td className="py-1.5 text-right tabular-nums">{money(it.amount)}</td>
                          <td className="py-1.5 pl-3 tabular-nums text-ink-3">{fmtDate(it.dueDate)}</td>
                          <td className="py-1.5 pl-3 text-right">
                            <span className={`font-medium ${it.status === 'PAID' ? 'text-ok' : 'text-risk'}`}>
                              {it.status === 'PAID' ? '✓ จ่ายแล้ว' : 'รอจ่าย'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-1.5 text-[11px] text-ink-3">แก้ไขงบ/งวด ที่หน้า Admin</p>
              </div>
            )}
            {/* filter: dept + bucket + clear (req3 — กรอง stage ในหน้า detail) */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="w-12 text-ink-3">แผนก:</span>
              {Object.entries(data.byDept).map(([k, v]) => (
                <button key={k} onClick={() => toggle(fDept, k, setFDept)} className={chip(fDept === k)}>
                  {k} <b className="tabular-nums">{v}</b>
                </button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="w-12 text-ink-3">สถานะ:</span>
              {Object.entries(byBucket).map(([k, v]) => (
                <button key={k} onClick={() => toggle(fBucket, k, setFBucket)} className={chip(fBucket === k)}>
                  {k} <b className="tabular-nums">{v}</b>
                </button>
              ))}
            </div>
            {hasFilter && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                {fSection && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700">section: {fSection}</span>}
                <button
                  onClick={() => {
                    setFDept(null);
                    setFBucket(null);
                    setFSection(null);
                  }}
                  className="btn-ghost btn-sm"
                >
                  ล้าง filter
                </button>
              </div>
            )}
            <table className="tbl">
              <thead>
                <tr>
                  <th className="!pl-0">ชื่อการ์ด</th>
                  <th>section</th>
                  <th>กำหนดส่ง</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.larkTaskGuid}>
                    <td className="max-w-xs !pl-0">
                      <span className="line-clamp-1">{t.title}</span>
                    </td>
                    <td className="text-xs text-ink-2">
                      <button className="text-left hover:text-brand-700 hover:underline" onClick={() => setFSection(t.sectionName)}>
                        {t.sectionName}
                      </button>
                    </td>
                    <td className={`whitespace-nowrap text-xs tabular-nums ${t.overdue ? 'font-semibold text-late' : 'text-ink-2'}`}>
                      {fmtDate(t.dueAt)}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <a href={t.larkUrl} target="_blank" rel="noreferrer" className="text-[13px] font-medium hover:underline">
                        เปิดใน Lark ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
