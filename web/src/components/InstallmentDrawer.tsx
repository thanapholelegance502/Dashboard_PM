import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { CashflowBucketKey, FinanceInstallment, FinanceResult } from '../lib/types';
import { money, fmtDate } from '../lib/format';
import { EmptyState, SkeletonRows } from './SectionCard';

export type FinanceDrill =
  | { kind: 'project'; code: string; instId?: number }
  | { kind: 'bucket'; bucket: CashflowBucketKey };

const BUCKET_KEYS: CashflowBucketKey[] = ['overdue', 'd0_30', 'd31_60', 'd61_90', 'd90plus', 'noDate'];

export const BUCKET_TITLE: Record<CashflowBucketKey, string> = {
  overdue: 'งวดที่เลยกำหนดชำระ',
  d0_30: 'งวดที่ครบกำหนดภายใน 30 วัน',
  d31_60: 'งวดที่ครบกำหนด 31 – 60 วัน',
  d61_90: 'งวดที่ครบกำหนด 61 – 90 วัน',
  d90plus: 'งวดที่ครบกำหนดเกิน 90 วัน',
  noDate: 'งวดที่ยังไม่ระบุวันครบกำหนด',
};

/**
 * อ่าน drill-down จาก URL — ?drill=p:CODE[&inst=42] | ?drill=b:overdue
 * param เพี้ยน = ถือว่าปิด (ห้าม throw — ลิงก์เสียต้องได้หน้า Finance ปกติ ไม่ใช่จอขาว)
 */
export function parseDrill(sp: URLSearchParams): FinanceDrill | null {
  const raw = sp.get('drill');
  if (!raw) return null;
  if (raw.startsWith('p:')) {
    const code = raw.slice(2).trim();
    if (!code) return null;
    const instRaw = sp.get('inst');
    const instId = instRaw && /^\d+$/.test(instRaw) ? Number(instRaw) : undefined;
    return { kind: 'project', code, instId: instId && instId > 0 ? instId : undefined };
  }
  if (raw.startsWith('b:')) {
    const b = raw.slice(2) as CashflowBucketKey;
    return BUCKET_KEYS.includes(b) ? { kind: 'bucket', bucket: b } : null;
  }
  return null;
}

/** สร้าง search params ของ drill-down (คู่กับ parseDrill) */
export function drillParams(d: FinanceDrill): Record<string, string> {
  if (d.kind === 'bucket') return { drill: `b:${d.bucket}` };
  return d.instId ? { drill: `p:${d.code}`, inst: String(d.instId) } : { drill: `p:${d.code}` };
}

interface Props {
  drill: FinanceDrill | null;
  data: FinanceResult | null;
  canEdit: boolean;
  onClose: () => void;
}

/**
 * งวดการเงิน — ดูอย่างเดียว (แก้ที่หน้าตั้งค่า)
 * ทุกยอดอ่านจาก FinanceResult ก้อนเดียวกับที่หน้า Finance ใช้ → เปิดแล้วไม่ยิง API เพิ่ม
 * (สำคัญ: /pm/projects/:code/budget ต้องใช้ board PM — C-level จะโดน 403)
 */
export default function InstallmentDrawer({ drill, data, canEdit, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLTableRowElement>(null);
  const restoreRef = useRef<Element | null>(null);

  const open = drill != null;

  // Escape ปิด + คืน focus ให้ตัวที่เปิด (DrillDownPanel เดิมยังไม่มี)
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = panelRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  const instId = drill?.kind === 'project' ? drill.instId : undefined;
  useEffect(() => {
    if (instId) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [instId, data]);

  const view = useMemo(() => {
    if (!drill || !data) return null;
    if (drill.kind === 'project') {
      const row = data.projects.find((p) => p.code === drill.code);
      return { row, items: data.installments.filter((i) => i.code === drill.code) };
    }
    const items = data.installments.filter((i) => i.bucket === drill.bucket);
    // group ตามโครงการ เรียงตามลำดับเดียวกับตารางในหน้า Finance
    const order = new Map(data.projects.map((p, idx) => [p.code, idx]));
    const groups = [...new Set(items.map((i) => i.code))]
      .sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
      .map((code) => ({
        code,
        displayName: data.projects.find((p) => p.code === code)?.displayName ?? code,
        items: items.filter((i) => i.code === code),
      }));
    return { items, groups };
  }, [drill, data]);

  if (!drill) return null;

  const isProject = drill.kind === 'project';
  const row = isProject ? view?.row : undefined;
  const bucketAgg = !isProject && data ? data.cashflow[drill.bucket] : null;

  const title = isProject ? (row?.displayName ?? drill.code) : BUCKET_TITLE[drill.bucket];
  const headId = 'drawer-title';

  return (
    <div className="no-print fixed inset-0 z-40 flex justify-end">
      <div className="flex-1 bg-[rgba(22,38,63,0.18)]" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headId}
        className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-panel outline-none"
      >
        <div className="flex flex-col gap-1.5 border-b border-hair px-[22px] pb-4 pt-5">
          <div className="flex items-center gap-3">
            {isProject && <span className="code text-ink-3">{drill.code}</span>}
            <button onClick={onClose} aria-label="ปิด" className="ml-auto flex h-7 w-7 items-center justify-center rounded-md bg-surface-2 text-sm text-ink-2 hover:text-ink">
              ✕
            </button>
          </div>
          <div className="flex items-baseline gap-2.5">
            <h3 id={headId} className="text-xl font-semibold">{title}</h3>
            {isProject && <span className="text-sm text-ink-3">งวดการเงิน</span>}
          </div>

          {/* ยอดหัว drawer อ่านจากแถว/แท่งที่เพิ่งกด — ไม่ sum ใหม่ (§12.2) */}
          {isProject && row && (
            <div className="flex flex-col gap-0.5 text-[13px] text-ink-2">
              <span className="tabular-nums">
                ตั้งงวดแล้ว {money(row.planned)} · เก็บแล้ว <span className="text-ok">{money(row.billed)}</span> · ค้างเก็บ {money(row.outstanding)}
              </span>
              {row.unplanned > 0 && <span className="tabular-nums text-ink-3">ยังไม่ตั้งงวด {money(row.unplanned)}</span>}
              {row.overPlanned > 0 && <span className="tabular-nums font-medium text-late">ตั้งงวดเกินมูลค่างาน {money(row.overPlanned)}</span>}
              {row.budget == null && <span className="text-ink-3">ยังไม่ได้ใส่มูลค่างาน</span>}
            </div>
          )}
          {!isProject && bucketAgg && (
            <span className="text-[13px] tabular-nums text-ink-2">
              {bucketAgg.count} งวด · {money(bucketAgg.amount)} · ทุกโครงการ
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-[22px] py-4">
          {!data && <SkeletonRows rows={5} />}

          {data && isProject && !row && (
            <EmptyState text="ไม่พบโครงการนี้" sub="โครงการอาจถูกปิดใช้งานไปแล้ว" tone="muted" />
          )}

          {data && isProject && row && view!.items.length === 0 && (
            <EmptyState
              text="โครงการนี้ยังไม่ได้ตั้งงวด"
              sub={row.budget != null ? `มูลค่างาน ${money(row.budget)} ยังไม่ถูกแบ่งงวด` : undefined}
              tone="muted"
            />
          )}

          {data && isProject && row && view!.items.length > 0 && (
            <InstallmentTable items={view!.items} highlightId={drill.instId} rowRef={rowRef} />
          )}

          {data && !isProject && view!.items.length === 0 && (
            <EmptyState text="ไม่มีงวดในช่วงนี้" tone={drill.bucket === 'overdue' ? 'ok' : 'muted'} />
          )}

          {data && !isProject && view!.groups!.map((g) => (
            <div key={g.code} className="mb-5 last:mb-0">
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="code text-ink-3">{g.code}</span>
                {g.displayName !== g.code && <span className="text-sm font-medium">{g.displayName}</span>}
              </div>
              <InstallmentTable items={g.items} />
            </div>
          ))}
        </div>

        <div className="border-t border-hair px-[22px] py-3 text-xs text-ink-3">
          {canEdit ? (
            <>ดูข้อมูลอย่างเดียว · แก้ไขงบ/งวด ที่หน้าตั้งค่า <Link to="/admin" className="font-medium text-brand-700 hover:underline">ไปหน้าตั้งค่า →</Link></>
          ) : (
            <>ดูข้อมูลอย่างเดียว · แก้ไขงบ/งวด ได้ที่หน้าตั้งค่า (ติดต่อ PM)</>
          )}
        </div>
      </div>
    </div>
  );
}

function InstallmentTable({
  items, highlightId, rowRef,
}: { items: FinanceInstallment[]; highlightId?: number; rowRef?: React.RefObject<HTMLTableRowElement> }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl min-w-[420px]">
        <thead>
          <tr>
            <th>งวด</th>
            <th className="!text-right">จำนวนเงิน</th>
            <th className="!text-right">กำหนดชำระ</th>
            <th className="!text-right">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const hit = highlightId === i.id;
            return (
              <tr
                key={i.id}
                ref={hit ? rowRef : undefined}
                aria-current={hit ? 'true' : undefined}
                className={hit ? 'bg-brand-50 ring-2 ring-inset ring-brand-700' : undefined}
              >
                <td className="font-medium">{i.name}</td>
                <td className="text-right tabular-nums">{money(i.amount)}</td>
                <td className="text-right tabular-nums text-ink-2">{fmtDate(i.dueDate)}</td>
                <td className="text-right"><InstallmentStatus i={i} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** แดง = ปัญหาเท่านั้น · ห้าม render "—" เป็นวันที่จ่าย (DESIGN-BRIEF §11) */
function InstallmentStatus({ i }: { i: FinanceInstallment }) {
  if (i.status === 'PAID') {
    return <span className="text-xs font-medium text-ok">✓ จ่ายแล้ว{i.paidAt ? ` ${fmtDate(i.paidAt)}` : ''}</span>;
  }
  if (i.bucket === 'overdue') {
    return <span className="text-xs font-semibold text-late">เลยกำหนด {i.overdueDays} วัน</span>;
  }
  if (i.bucket === 'noDate') {
    return <span className="text-xs text-ink-3">รอชำระ · ไม่ระบุวันครบกำหนด</span>;
  }
  return <span className="text-xs text-ink-2">รอชำระ</span>;
}
