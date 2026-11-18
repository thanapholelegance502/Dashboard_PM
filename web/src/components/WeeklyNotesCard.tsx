import { useEffect, useRef, useState } from 'react';
import { getWeeklyNote, saveWeeklyNote, closeWeeklyReport } from '../lib/api';
import type { WeeklyNoteData, WeeklyNoteState } from '../lib/types';
import { fmtDateTime } from '../lib/format';
import { useAuth } from '../lib/auth';
import SectionCard, { SkeletonRows, ErrorBox } from './SectionCard';

const FIELDS: Array<{ key: keyof WeeklyNoteData; label: string; placeholder: string }> = [
  { key: 'summary', label: 'สรุปภาพรวม', placeholder: 'ภาพรวมความคืบหน้าของสัปดาห์นี้…' },
  { key: 'issues', label: 'ปัญหาและอุปสรรค', placeholder: 'ติดอะไร รอใคร ต้องการการตัดสินใจอะไร…' },
  { key: 'outOfScope', label: 'งานนอก scope ที่ทำเพิ่มเติม', placeholder: 'งานแทรก/นอกแผนที่ทีมทำให้สัปดาห์นี้…' },
];

/** การ์ดโน้ตรายสัปดาห์ (บอร์ด KHAW) — 3 ช่อง ลง PDF · onClosed = ให้ parent รีโหลดรายงานย้อนหลัง */
export default function WeeklyNotesCard({ onClosed }: { onClosed?: () => void }) {
  const { user } = useAuth();
  const canEdit = !!user && ['ADMIN', 'PM'].includes(user.role);

  const [state, setState] = useState<WeeklyNoteState | null>(null);
  const [draft, setDraft] = useState<WeeklyNoteData>({ summary: '', issues: '', outOfScope: '' });
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const load = () =>
    getWeeklyNote()
      .then((s) => { setState(s); setDraft(s.note); setDirty(false); setLoadErr(null); })
      .catch((e) => setLoadErr((e as Error).message));
  useEffect(() => { load(); }, []);

  // เตือนถ้าออกจากหน้าโดยยังไม่บันทึก
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  if (loadErr && !state) {
    return (
      <SectionCard title="บันทึกประจำสัปดาห์">
        <ErrorBox title={`โหลดโน้ตไม่ได้: ${loadErr}`} onRetry={load} />
      </SectionCard>
    );
  }
  if (!state) {
    return <SectionCard title="บันทึกประจำสัปดาห์"><SkeletonRows rows={4} /></SectionCard>;
  }

  const locked = state.closed || !canEdit;
  const set = (key: keyof WeeklyNoteData, v: string) => {
    setDraft((d) => ({ ...d, [key]: v }));
    setDirty(true);
  };

  const doSave = async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const s = await saveWeeklyNote(state.weekKey, draft);
      setState(s); setDraft(s.note); setDirty(false);
    } catch (e) {
      setSaveErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doClose = async () => {
    if (!window.confirm('ปิดสัปดาห์นี้แล้วจะแก้โน้ตไม่ได้ และเก็บ PDF ฉบับย้อนหลังทันที — ยืนยัน?')) return;
    setClosing(true);
    setSaveErr(null);
    try {
      if (dirty) await saveWeeklyNote(state.weekKey, draft); // กันโน้ตที่ยังไม่เซฟหลุด
      await closeWeeklyReport();
      await load();
      onClosed?.();
    } catch (e) {
      setSaveErr((e as Error).message);
    } finally {
      setClosing(false);
    }
  };

  const savedAt = state.updatedAt ? `บันทึกล่าสุด ${fmtDateTime(state.updatedAt)}` : 'ยังไม่เคยบันทึก';

  return (
    <SectionCard
      title={`บันทึกประจำสัปดาห์ ${state.weekRange}`}
      right={
        state.closed
          ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-2">ปิดสัปดาห์แล้ว · อ่านอย่างเดียว</span>
          : <span className="text-xs text-ink-3">{dirty ? 'ยังไม่บันทึก' : savedAt}</span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">{f.label}</span>
              <textarea
                value={draft[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                readOnly={locked}
                rows={6}
                className="field-input min-h-[120px] resize-y text-sm leading-relaxed read-only:cursor-default read-only:bg-surface-2 read-only:text-ink-2"
              />
            </label>
          ))}
        </div>

        {saveErr && <div className="text-sm text-late">บันทึกไม่ได้: {saveErr}</div>}

        {!locked && (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={doSave} disabled={saving || !dirty} className="btn-primary">
              {saving ? 'กำลังบันทึก…' : 'บันทึกโน้ต'}
            </button>
            <button onClick={doClose} disabled={closing} className="btn-secondary" title="เก็บ PDF ฉบับย้อนหลังทันที แล้วล็อกโน้ตสัปดาห์นี้">
              {closing ? 'กำลังปิดสัปดาห์…' : 'ปิดสัปดาห์ตอนนี้'}
            </button>
            <span className="text-xs text-ink-3">โน้ตนี้จะขึ้นหน้าแรกของ PDF สรุปรายสัปดาห์</span>
          </div>
        )}
        {state.closed && (
          <p className="text-xs text-ink-3">สัปดาห์นี้ปิดแล้ว — ดูฉบับที่เก็บไว้ได้ในการ์ด “รายงานย้อนหลัง”</p>
        )}
        {!canEdit && !state.closed && (
          <p className="text-xs text-ink-3">คุณมีสิทธิ์ดูอย่างเดียว — เฉพาะ PM/Admin แก้โน้ตได้</p>
        )}
      </div>
    </SectionCard>
  );
}
