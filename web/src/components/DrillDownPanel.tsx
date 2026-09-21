import { useEffect, useState } from 'react';
import { getDrilldown, getBudget } from '../lib/api';
import type { DrilldownResult, BudgetResult } from '../lib/types';
import { fmtDate, money } from '../lib/format';

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

  return (
    <div className="fixed inset-0 z-40 flex justify-end no-print">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-slate-500">{code}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tabular-nums">
              {data ? (hasFilter ? `${filtered.length}/${data.total} ใบ` : `${data.total} ใบ`) : ''}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
              ✕
            </button>
          </div>
        </div>

        {loading && <div className="p-6 text-sm text-slate-400">กำลังโหลด…</div>}
        {err && <div className="p-6 text-sm text-delayed">ผิดพลาด: {err}</div>}

        {data && (
          <div className="flex-1 overflow-y-auto p-4">
            {/* budget + งวดการเงิน (req2) */}
            {budget && (budget.budget != null || budget.installments.length > 0) && (
              <div className="mb-4 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-600">งบประมาณ</span>
                  <span className="tabular-nums">
                    จ่ายแล้ว <b>{money(budget.paid)}</b> / {money(budget.budget)}
                    {budget.burnPct != null && <span className="ml-1 text-slate-400">({budget.burnPct}%)</span>}
                  </span>
                </div>
                {budget.budget != null && budget.budget > 0 && (
                  <div className="mb-2 h-2 overflow-hidden rounded bg-slate-200">
                    <div
                      className={`h-full rounded ${(budget.burnPct ?? 0) > 100 ? 'bg-delayed' : 'bg-ontrack'}`}
                      style={{ width: `${Math.min(budget.burnPct ?? 0, 100)}%` }}
                    />
                  </div>
                )}
                {budget.installments.length > 0 && (
                  <table className="w-full text-xs">
                    <tbody>
                      {budget.installments.map((it) => (
                        <tr key={it.id} className="border-t border-slate-200">
                          <td className="py-1">{it.name}</td>
                          <td className="py-1 text-right tabular-nums">{money(it.amount)}</td>
                          <td className="py-1 pl-2 text-slate-500">{fmtDate(it.dueDate)}</td>
                          <td className="py-1 pl-2">
                            <span className={it.status === 'PAID' ? 'text-ontrack' : 'text-atrisk'}>
                              {it.status === 'PAID' ? '✓ จ่ายแล้ว' : 'รอจ่าย'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-1 text-[10px] text-slate-400">แก้ไขงบ/งวด ที่หน้า Admin</p>
              </div>
            )}
            {/* filter: dept + bucket + clear (req3 — กรอง stage ในหน้า detail) */}
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400">แผนก:</span>
              {Object.entries(data.byDept).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => toggle(fDept, k, setFDept)}
                  className={`rounded px-2 py-1 ${fDept === k ? 'bg-doing text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
                >
                  {k} <b>{v}</b>
                </button>
              ))}
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400">สถานะ:</span>
              {Object.entries(byBucket).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => toggle(fBucket, k, setFBucket)}
                  className={`rounded px-2 py-1 ${fBucket === k ? 'bg-doing text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
                >
                  {k} <b>{v}</b>
                </button>
              ))}
            </div>
            {hasFilter && (
              <div className="mb-2 flex items-center gap-2 text-xs">
                {fSection && <span className="rounded bg-doing/10 px-2 py-1">section: {fSection}</span>}
                <button
                  onClick={() => {
                    setFDept(null);
                    setFBucket(null);
                    setFSection(null);
                  }}
                  className="text-doing hover:underline"
                >
                  ล้าง filter
                </button>
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5">ชื่อการ์ด</th>
                  <th>section</th>
                  <th>กำหนดส่ง</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.larkTaskGuid} className="border-b border-slate-100">
                    <td className="max-w-xs py-1.5 pr-2">
                      <span className="line-clamp-1">{t.title}</span>
                    </td>
                    <td className="pr-2 text-xs text-slate-500">
                      <button className="text-left hover:text-doing hover:underline" onClick={() => setFSection(t.sectionName)}>
                        {t.sectionName}
                      </button>
                    </td>
                    <td className={`pr-2 text-xs ${t.overdue ? 'font-semibold text-delayed' : 'text-slate-500'}`}>
                      {fmtDate(t.dueAt)}
                    </td>
                    <td>
                      <a href={t.larkUrl} target="_blank" rel="noreferrer" className="text-xs text-doing hover:underline">
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
