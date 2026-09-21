import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAdminProjects, patchProject, testConnection, statusOverride, progressOverride,
  getUnmappedSections, getSectionRules, createProject,
  getBudget, createInstallment, patchInstallment, deleteInstallment,
  createSectionRule, patchSectionRule, deleteSectionRule, recompute,
} from '../lib/api';
import type { AdminProject, UnmappedSection, SectionRule, BudgetResult } from '../lib/types';
import { money, fmtDate } from '../lib/format';

const DATE_FIELDS: (keyof AdminProject)[] = [
  'startDate', 'targetUat', 'forecastUat', 'targetGolive', 'forecastGolive', 'actualUat', 'actualGolive',
];
const DATE_LABEL: Record<string, string> = {
  startDate: 'Start', targetUat: 'Target UAT', forecastUat: 'Forecast UAT',
  targetGolive: 'Target Go-Live', forecastGolive: 'Forecast Go-Live', actualUat: 'Actual UAT', actualGolive: 'Actual Go-Live',
};

// ── shared styles ──────────────────────────────────
const input = 'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none';
const btnPrimary = 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700';
const btnGhost = 'text-sm text-slate-500 hover:text-slate-900';
const label = 'text-[11px] font-medium uppercase tracking-wider text-slate-400';

export default function Admin() {
  const [tab, setTab] = useState<'projects' | 'rules'>('projects');
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="flex items-end justify-between border-b border-slate-200 pb-5">
          <div>
            <div className={label}>Settings</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">ตั้งค่าระบบ</h1>
          </div>
          <Link to="/" className={btnGhost}>← Dashboard</Link>
        </header>

        <nav className="mt-4 flex gap-6 border-b border-slate-200 text-sm">
          <TabBtn active={tab === 'projects'} onClick={() => setTab('projects')}>โครงการ · Milestone</TabBtn>
          <TabBtn active={tab === 'rules'} onClick={() => setTab('rules')}>Section Rules</TabBtn>
        </nav>

        <div className="py-6">{tab === 'projects' ? <ProjectsTab /> : <RulesTab />}</div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2.5 font-medium ${active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
    >
      {children}
    </button>
  );
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="mb-5 rounded-md bg-slate-900 px-3 py-2 text-sm text-white">{msg}</div>;
}

// ══ Projects ═══════════════════════════════════════
function ProjectsTab() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [msg, setMsg] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ projectCode: '', displayName: '', larkTasklistGuid: '' });

  const load = () => getAdminProjects().then(setProjects);
  useEffect(() => { load(); }, []);

  const normalizeCode = (v: string) => v.toUpperCase().replace(/\s+/g, '_');
  const toInput = (v: string | null) => (v ? v.slice(0, 10) : '');

  const saveDates = async (p: AdminProject, patch: Partial<AdminProject>) => {
    await patchProject(p.projectCode, patch);
    setMsg(`บันทึก ${p.projectCode}`);
    load();
  };
  const doAdd = async () => {
    const code = normalizeCode(form.projectCode.trim());
    const guid = form.larkTasklistGuid.trim();
    if (!code || !guid) { setMsg('ต้องมี project code + tasklist guid'); return; }
    try {
      await createProject({ projectCode: code, displayName: form.displayName.trim() || undefined, larkTasklistGuid: guid });
      setForm({ projectCode: '', displayName: '', larkTasklistGuid: '' });
      setShowAdd(false);
      await load();
      const r = await testConnection(code);
      setMsg(r.ok ? `${code}: อ่านได้ ${r.cards} การ์ด — กด Sync now ที่ Dashboard` : `${code} เพิ่มแล้ว แต่: ${r.error}`);
    } catch (e) { setMsg((e as Error).message); }
  };
  const doTest = async (code: string) => {
    setMsg(`กำลังทดสอบ ${code}…`);
    const r = await testConnection(code);
    setMsg(r.ok ? `${code}: อ่านได้ ${r.cards} การ์ด / ${r.sections} section` : `${code}: ${r.error}`);
  };
  const doStatusOverride = async (code: string) => {
    const status = prompt('สถานะ (ON_TRACK/AT_RISK/DELAYED/DONE):'); if (!status) return;
    const reason = prompt('เหตุผล (≥10 ตัวอักษร):') ?? '';
    try { await statusOverride(code, status, reason); setMsg(`override สถานะ ${code}`); load(); }
    catch (e) { setMsg((e as Error).message); }
  };
  const doProgressOverride = async (code: string) => {
    const v = prompt('progress % (0-100):'); if (!v) return;
    const reason = prompt('เหตุผล (≥10 ตัวอักษร):') ?? '';
    try { await progressOverride(code, Number(v), reason); setMsg(`override progress ${code}`); load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div>
      <Toast msg={msg} />

      {showAdd ? (
        <div className="mb-6 rounded-lg border border-slate-300 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">เพิ่มโครงการใหม่</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Project Code *">
              <input value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })}
                onBlur={(e) => setForm((f) => ({ ...f, projectCode: normalizeCode(e.target.value) }))}
                placeholder="TCG_COLLATERAL" className={input + ' w-full'} />
            </Field>
            <Field label="ชื่อแสดง (ว่าง = ใช้ code)">
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={input + ' w-full'} />
            </Field>
            <Field label="Lark tasklist_guid *">
              <input value={form.larkTasklistGuid} onChange={(e) => setForm({ ...form, larkTasklistGuid: e.target.value })}
                placeholder="b569b7d4-…" className={input + ' w-full font-mono text-xs'} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-slate-400">ก็อบ guid จาก URL บอร์ด Lark · ข้าวต้องเป็นสมาชิกบอร์ดนั้น</p>
          <div className="mt-3 flex gap-3">
            <button onClick={doAdd} className={btnPrimary}>เพิ่ม + ทดสอบ</button>
            <button onClick={() => setShowAdd(false)} className={btnGhost}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="mb-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-900">
          + เพิ่มโครงการ
        </button>
      )}

      <div className="divide-y divide-slate-200">
        {projects.map((p) => (
          <div key={p.id} className="py-6 first:pt-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-900">{p.displayName}</h3>
                {(p.statusOverride || p.progressOverride != null) && (
                  <span className="text-xs text-amber-600">
                    override {p.statusOverride ?? ''} {p.progressOverride != null ? `· ${p.progressOverride}%` : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-xs">
                <button onClick={() => doTest(p.projectCode)} className={btnGhost}>ทดสอบการเชื่อมต่อ</button>
                <button onClick={() => doStatusOverride(p.projectCode)} className={btnGhost}>Override สถานะ</button>
                <button onClick={() => doProgressOverride(p.projectCode)} className={btnGhost}>Override progress</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
              {DATE_FIELDS.map((f) => (
                <Field key={f} label={DATE_LABEL[f]}>
                  <input type="date" defaultValue={toInput(p[f] as string | null)}
                    onBlur={(e) => { const v = e.target.value || null; if (v !== toInput(p[f] as string | null)) saveDates(p, { [f]: v } as Partial<AdminProject>); }}
                    className={input} />
                </Field>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Field label="งบประมาณ (บาท)">
                <input type="number" defaultValue={p.budget ?? ''}
                  onBlur={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); if (v !== p.budget) saveDates(p, { budget: v } as Partial<AdminProject>); }}
                  className={input + ' w-44'} />
              </Field>
            </div>
            <InstallmentEditor code={p.projectCode} onChange={() => setMsg('อัพเดตงวดแล้ว')} />
          </div>
        ))}
      </div>
    </div>
  );
}

function InstallmentEditor({ code, onChange }: { code: string; onChange: () => void }) {
  const [data, setData] = useState<BudgetResult | null>(null);
  const [form, setForm] = useState({ name: '', amount: '', dueDate: '' });
  const [open, setOpen] = useState(false);

  const load = () => getBudget(code).then(setData).catch(() => {});
  useEffect(() => { if (open) load(); }, [open]);

  const add = async () => {
    if (!form.name || !form.amount) return;
    await createInstallment(code, { name: form.name, amount: Number(form.amount), dueDate: form.dueDate || null });
    setForm({ name: '', amount: '', dueDate: '' }); load(); onChange();
  };
  const togglePaid = async (id: number, cur: string) => { await patchInstallment(id, { status: cur === 'PAID' ? 'PENDING' : 'PAID' }); load(); onChange(); };
  const del = async (id: number) => { await deleteInstallment(id); load(); onChange(); };

  if (!open) return <button onClick={() => setOpen(true)} className="mt-3 text-xs text-slate-500 hover:text-slate-900">จัดการงวดการเงิน →</button>;

  return (
    <div className="mt-4 border-l-2 border-slate-200 pl-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          งวดการเงิน{data && <> · จ่ายแล้ว {money(data.paid)} / {money(data.budget)} {data.burnPct != null && `(${data.burnPct}%)`}</>}
        </span>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400">ปิด</button>
      </div>
      {data?.installments.map((it) => (
        <div key={it.id} className="flex items-center gap-3 border-t border-slate-100 py-1.5 text-xs">
          <span className="flex-1">{it.name}</span>
          <span className="tabular-nums">{money(it.amount)}</span>
          <span className="text-slate-400">{fmtDate(it.dueDate)}</span>
          <button onClick={() => togglePaid(it.id, it.status)}
            className={`rounded px-2 py-0.5 ${it.status === 'PAID' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {it.status === 'PAID' ? 'จ่ายแล้ว' : 'รอจ่าย'}
          </button>
          <button onClick={() => del(it.id)} className="text-slate-300 hover:text-red-600">✕</button>
        </div>
      ))}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input placeholder="ชื่องวด (งวด 1 · มัดจำ)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input + ' flex-1 text-xs'} />
        <input type="number" placeholder="จำนวน" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input + ' w-24 text-xs'} />
        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={input + ' text-xs'} />
        <button onClick={add} className="rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white">เพิ่ม</button>
      </div>
    </div>
  );
}

// ══ Section Rules ══════════════════════════════════
const DEPTS = ['PM', 'BA', 'UXUI', 'DEV', 'QA', 'NONE'];
const BUCKETS = ['BACKLOG', 'IN_PROGRESS', 'WAITING', 'DONE', 'BLOCKED'];
const MATCH_TYPES = ['EXACT', 'CONTAINS', 'FALLBACK'];
const sel = 'rounded border border-slate-200 px-1.5 py-1 text-xs focus:border-slate-900 focus:outline-none';

function RulesTab() {
  const [unmapped, setUnmapped] = useState<UnmappedSection[]>([]);
  const [rules, setRules] = useState<SectionRule[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Partial<SectionRule> | null>(null);

  const load = () => {
    getUnmappedSections().then(setUnmapped).catch(() => {});
    getSectionRules().then(setRules).catch(() => {});
    getAdminProjects().then(setProjects).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  const projName = (id: number | null) => (id ? projects.find((p) => p.id === id)?.projectCode ?? `#${id}` : 'global');

  const afterChange = async (labelTxt: string) => {
    setBusy(true);
    try { const r = await recompute(); setMsg(`${labelTxt} · อัพเดต ${r.changed} ใบ · unmapped เหลือ ${r.unmapped}`); load(); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const editRule = async (id: number, data: Partial<SectionRule>) => { await patchSectionRule(id, data); await afterChange('แก้ rule'); };
  const removeRule = async (id: number) => { await deleteSectionRule(id); await afterChange('ลบ rule'); };
  const saveNew = async () => {
    if (!form?.pattern || !form?.deptCode || !form?.bucketCode) { setMsg('ต้องมี pattern + dept + bucket'); return; }
    await createSectionRule({
      matchType: form.matchType ?? 'EXACT', pattern: form.pattern, deptCode: form.deptCode, bucketCode: form.bucketCode,
      weight: Number(form.weight ?? 0), priority: Number(form.priority ?? 15), projectId: form.projectId ?? null, isActive: true,
    });
    setForm(null); await afterChange('เพิ่ม rule');
  };
  const mapSection = (u: UnmappedSection) =>
    setForm({ matchType: 'EXACT', pattern: u.sectionName, projectId: u.projectId, priority: 15, weight: 0, deptCode: 'QA', bucketCode: 'DONE' });

  return (
    <div>
      <Toast msg={msg} />
      {busy && <div className="mb-4 text-sm text-slate-400">กำลัง recompute…</div>}

      {unmapped.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-600">{unmapped.length} section ยังไม่ได้ map</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {unmapped.map((u, i) => (
              <button key={i} onClick={() => mapSection(u)} className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs hover:border-red-400">
                {projName(u.projectId)} · {u.sectionName} <span className="text-slate-400">({u.cardCount})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {form ? (
        <div className="mb-6 rounded-lg border border-slate-300 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">เพิ่ม / map section rule</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="บอร์ด">
              <select value={form.projectId ?? ''} onChange={(e) => setForm({ ...form, projectId: e.target.value ? Number(e.target.value) : null })} className={input + ' w-full'}>
                <option value="">global</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.projectCode}</option>)}
              </select>
            </Field>
            <Field label="match"><select value={form.matchType} onChange={(e) => setForm({ ...form, matchType: e.target.value })} className={input + ' w-full'}>{MATCH_TYPES.map((m) => <option key={m}>{m}</option>)}</select></Field>
            <Field label="pattern (ชื่อ section)"><input value={form.pattern ?? ''} onChange={(e) => setForm({ ...form, pattern: e.target.value })} className={input + ' w-full'} /></Field>
            <Field label="priority"><input type="number" value={form.priority ?? 15} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className={input + ' w-full'} /></Field>
            <Field label="dept"><select value={form.deptCode} onChange={(e) => setForm({ ...form, deptCode: e.target.value })} className={input + ' w-full'}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Field label="bucket"><select value={form.bucketCode} onChange={(e) => setForm({ ...form, bucketCode: e.target.value })} className={input + ' w-full'}>{BUCKETS.map((b) => <option key={b}>{b}</option>)}</select></Field>
            <Field label="weight (0-100)"><input type="number" value={form.weight ?? 0} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} className={input + ' w-full'} /></Field>
          </div>
          <div className="mt-3 flex gap-3">
            <button onClick={saveNew} className={btnPrimary}>บันทึก + recompute</button>
            <button onClick={() => setForm(null)} className={btnGhost}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setForm({ matchType: 'EXACT', priority: 15, weight: 0, deptCode: 'QA', bucketCode: 'DONE', projectId: null })}
          className="mb-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-900">
          + เพิ่ม rule
        </button>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
            <th className="pb-2 text-left font-medium">scope</th><th className="pb-2 text-left font-medium">pattern</th>
            <th className="pb-2 text-left font-medium">dept</th><th className="pb-2 text-left font-medium">bucket</th>
            <th className="pb-2 text-left font-medium">weight</th><th className="pb-2 text-left font-medium">pri</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className={`border-b border-slate-100 ${r.isActive ? '' : 'opacity-40'}`}>
              <td className="py-1.5 pr-2 text-xs text-slate-400">{projName(r.projectId)}</td>
              <td className="pr-2 text-slate-700">{r.pattern}</td>
              <td className="pr-1"><select defaultValue={r.deptCode} onChange={(e) => editRule(r.id, { deptCode: e.target.value })} className={sel}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></td>
              <td className="pr-1"><select defaultValue={r.bucketCode} onChange={(e) => editRule(r.id, { bucketCode: e.target.value })} className={sel}>{BUCKETS.map((b) => <option key={b}>{b}</option>)}</select></td>
              <td className="pr-1"><input type="number" defaultValue={r.weight} onBlur={(e) => Number(e.target.value) !== r.weight && editRule(r.id, { weight: Number(e.target.value) })} className={sel + ' w-14'} /></td>
              <td className="pr-1 text-xs text-slate-400">{r.priority}</td>
              <td><button onClick={() => removeRule(r.id)} className="text-xs text-slate-300 hover:text-red-600">ลบ</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={label}>{l}</span>
      {children}
    </label>
  );
}
