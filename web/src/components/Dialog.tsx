import { useEffect } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}

/** modal กลางจอ — แทน prompt()/confirm() ของ browser */
export default function Dialog({ open, title, onClose, children, actions }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(22,38,63,0.28)]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex w-full max-w-md flex-col gap-3.5 rounded-xl border border-line bg-surface p-5 shadow-panel">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="flex flex-col gap-3.5">{children}</div>
        <div className="flex justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

/** ยืนยันก่อนทำสิ่งที่ย้อนกลับไม่ได้ (ลบ) */
export function ConfirmDialog({
  open, title, detail, confirmLabel = 'ลบ', onConfirm, onClose,
}: { open: boolean; title: string; detail?: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      actions={
        <>
          <button onClick={onClose} className="btn-secondary">ยกเลิก</button>
          <button onClick={() => { onConfirm(); onClose(); }} className="btn-danger">{confirmLabel}</button>
        </>
      }
    >
      {detail && <p className="text-sm text-ink-2">{detail}</p>}
    </Dialog>
  );
}

/** แจ้งผลการทำงาน — แถบเข้ม ปิดได้ */
export function Toast({ msg, onClose }: { msg: string; onClose?: () => void }) {
  if (!msg) return null;
  return (
    <div role="status" className="mb-5 flex items-center gap-2.5 rounded-[10px] bg-ink px-3.5 py-3 text-sm text-white">
      <span className="h-2 w-2 shrink-0 rounded-full bg-[#5BC08A]" />
      <span className="min-w-0 flex-1">{msg}</span>
      {onClose && (
        <button onClick={onClose} className="text-[13px] font-semibold text-[#9FB6D6] hover:text-white">ปิด</button>
      )}
    </div>
  );
}
