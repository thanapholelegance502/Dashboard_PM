import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell';
import {
  getAdminProjects, patchProject, testConnection, statusOverride, progressOverride,
  getUnmappedSections, getSectionRules, createProject,
  getBudget, createInstallment, patchInstallment, deleteInstallment,
  createSectionRule, patchSectionRule, deleteSectionRule, recompute,
  getUsers, createUser, patchUser, getSyncStatus, larkAuthorizeUrl,
} from '../lib/api';
import type { AdminProject, UnmappedSection, SectionRule, BudgetResult, AppUserRow } from '../lib/types';
import { useAuth } from '../lib/auth';
import { money, fmtDate } from '../lib/format';
import { STATUS_LABEL } from '../lib/theme';
import Dialog, { ConfirmDialog, Toast } from '../components/Dialog';

const DATE_FIELDS: (keyof AdminProject)[] = [
  'startDate', 'targetUat', 'actualUat', 'targetGolive', 'actualGolive',
];
const DATE_LABEL: Record<string, string> = {
  startDate: 'Start', targetUat: 'Target UAT', actualUat: 'Actual UAT',
  targetGolive: 'Target Go-Live', actualGolive: 'Actual Go-Live',
};

// ── shared styles ──────────────────────────────────
const input = 'field-input';
const btnPrimary = 'btn-primary';
const btnGhost = 'btn-ghost';
const btnAdd = 'btn-secondary mb-4';
const label = 'field-label';
const formBox = 'card mb-5 p-5';

export default function Admin() {
  const [tab, setTab] = useState<'projects' | 'rules' | 'users'>('projects');
  const isAdmin = useAuth().user?.role === 'ADMIN'; // จัดการผู้ใช้ = ADMIN เท่านั้น
  return (
    <AppShell title="ตั้งค่าระบบ" eyebrow="Settings · Projects · Section Rules · Users">
      <div className="max-w-5xl">
        {isAdmin && <LarkConnectCard />}
        <nav className="seg mb-5 max-w-full overflow-x-auto">
          <TabBtn active={tab === 'projects'} onClick={() => setTab('projects')}>โครงการ · Milestone</TabBtn>
          <TabBtn active={tab === 'rules'} onClick={() => setTab('rules')}>Section Rules</TabBtn>
          {isAdmin && <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>ผู้ใช้</TabBtn>}
        </nav>
        {tab === 'projects' && <ProjectsTab />}
        {tab === 'rules' && <RulesTab />}
        {tab === 'users' && isAdmin && <UsersTab />}
      </div>
    </AppShell>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`seg-opt shrink-0 px-4 py-1.5 ${active ? 'seg-opt-on' : ''}`}>
      {children}
    </button>
  );
}

// ══ Lark connection (token ETL) ═════════════════════
// ปุ่มพาไป Lark → callback กลับมา /admin?lark=connected|failed (server/src/api/routes/auth.js)
const LARK_RESULT: Record<string, { text: string; cls: string }> = {
  connected: { text: 'เชื่อม Lark สำเร็จ — กด Sync now ที่ Dashboard เพื่อดึงข้อมูลรอบใหม่', cls: 'border-ok-bd bg-ok-bg text-ok' },
  failed: { text: 'เชื่อม Lark ไม่สำเร็จ — ลองกดใหม่อีกครั้ง (ถ้ายังไม่ได้ ดู server log)', cls: 'border-late-bd bg-late-bg text-late' },
};

function LarkConnectCard() {
  const [result] = useState(() => new URLSearchParams(window.location.search).get('lark') ?? '');
  const [needReauth, setNeedReauth] = useState(false);

  useEffect(() => {
    // ลบ ?lark=… ออกจาก URL — refresh แล้วข้อความไม่เด้งซ้ำ
    if (result) window.history.replaceState(null, '', window.location.pathname);
    getSyncStatus().then((s) => setNeedReauth(s.needReauthorize)).catch(() => {});
  }, [result]);

  const banner = LARK_RESULT[result];
  const showWarn = needReauth && result !== 'connected';
  return (
    <div className="mb-5 space-y-3">
      {banner && <div className={`rounded-lg border px-3.5 py-2.5 text-sm font-medium ${banner.cls}`}>{banner.text}</div>}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-card ${showWarn ? 'border-risk-bd bg-risk-bg' : 'border-line bg-surface'}`}>
        <div className="flex items-start gap-3 text-sm">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${showWarn ? 'bg-risk-dot' : 'bg-ok'}`} />
          <div>
          <div className="font-semibold">การเชื่อมต่อ Lark (token ETL)</div>
          <div className={showWarn ? 'text-risk' : 'text-ink-2'}>
            {showWarn
              ? '⚠️ token หมดอายุ — sync ดึงข้อมูลไม่ได้ ต้องเชื่อม Lark ใหม่'
              : 'ใช้เมื่อ sync แจ้งว่าต้อง authorize ใหม่ · login Lark ด้วยบัญชีที่เห็นทุกบอร์ด'}
          </div>
          </div>
        </div>
        <a href={larkAuthorizeUrl} className={`${btnPrimary} hover:text-white`}>เชื่อม Lark ใหม่</a>
      </div>
    </div>
  );
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
  // override ผ่าน dialog (แทน prompt()) — API เดิม: statusOverride / progressOverride
  const [ovr, setOvr] = useState<{ kind: 'status' | 'progress'; code: string; value: string; reason: string } | null>(null);
  const saveOverride = async () => {
    if (!ovr) return;
    const { kind, code, value, reason } = ovr;
    if (!value) return;
    try {
      if (kind === 'status') { await statusOverride(code, value, reason); setMsg(`override สถานะ ${code}`); }
      else { await progressOverride(code, Number(value), reason); setMsg(`override progress ${code}`); }
      setOvr(null); load();
    } catch (e) { setMsg((e as Error).message); setOvr(null); }
  };

  return (
    <div>
      <Toast msg={msg} onClose={() => setMsg('')} />

      {showAdd ? (
        <div className={formBox}>
          <h3 className="mb-3 text-base font-semibold">เพิ่มโครงการใหม่</h3>
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
                placeholder="b569b7d4-…" className={input + ' w-full font-mono !text-xs'} />
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-3">ก็อบ guid จาก URL บอร์ด Lark · ข้าวต้องเป็นสมาชิกบอร์ดนั้น</p>
          <div className="mt-3 flex gap-3">
            <button onClick={doAdd} className={btnPrimary}>เพิ่ม + ทดสอบ</button>
            <button onClick={() => setShowAdd(false)} className={btnGhost}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className={btnAdd}>
          + เพิ่มโครงการ
        </button>
      )}

      <div className="flex flex-col gap-4">
        {projects.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-hair pb-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold">{p.displayName}</h3>
                <span className="code text-ink-3">{p.projectCode}</span>
                {(p.statusOverride || p.progressOverride != null) && (
                  <span className="rounded-full border border-risk-bd bg-risk-bg px-2 py-0.5 text-xs font-medium text-risk">
                    override {p.statusOverride ?? ''} {p.progressOverride != null ? `· ${p.progressOverride}%` : ''}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => doTest(p.projectCode)} className={`${btnGhost} btn-sm`}>ทดสอบการเชื่อมต่อ</button>
                <button onClick={() => setOvr({ kind: 'status', code: p.projectCode, value: p.statusOverride ?? '', reason: '' })} className={`${btnGhost} btn-sm`}>Override สถานะ</button>
                <button onClick={() => setOvr({ kind: 'progress', code: p.projectCode, value: p.progressOverride != null ? String(p.progressOverride) : '', reason: '' })} className={`${btnGhost} btn-sm`}>Override progress</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-5">
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

      <OverrideDialog ovr={ovr} onChange={setOvr} onSave={saveOverride} />
    </div>
  );
}

const OVERRIDE_STATUSES = ['ON_TRACK', 'AT_RISK', 'DELAYED', 'DONE', 'WAITING'] as const;

function OverrideDialog({ ovr, onChange, onSave }: {
  ovr: { kind: 'status' | 'progress'; code: string; value: string; reason: string } | null;
  onChange: (o: { kind: 'status' | 'progress'; code: string; value: string; reason: string } | null) => void;
  onSave: () => void;
}) {
  const close = () => onChange(null);
  const reasonLen = ovr?.reason.trim().length ?? 0;
  return (
    <Dialog
      open={!!ovr}
      title={ovr ? `${ovr.kind === 'status' ? 'Override สถานะ' : 'Override progress'} · ${ovr.code}` : ''}
      onClose={close}
      actions={
        <>
          <button onClick={close} className="btn-secondary">ยกเลิก</button>
          <button onClick={onSave} disabled={!ovr?.value} className="btn-primary">บันทึก override</button>
        </>
      }
    >
      {ovr?.kind === 'status' ? (
        <div className="flex flex-col gap-1.5">
          <span className={label}>สถานะ</span>
          <div className="seg flex-wrap">
            {OVERRIDE_STATUSES.map((st) => (
              <button key={st} onClick={() => onChange({ ...ovr, value: st })} className={`seg-opt ${ovr.value === st ? 'seg-opt-on' : ''}`}>
                {STATUS_LABEL[st]}
              </button>
            ))}
          </div>
          <span className="text-xs text-ink-3">WAITING = รอเริ่ม</span>
        </div>
      ) : ovr ? (
        <label className="flex flex-col gap-1.5">
          <span className={label}>progress % (0-100)</span>
          <input type="number" min={0} max={100} value={ovr.value} onChange={(e) => onChange({ ...ovr, value: e.target.value })} className={input + ' w-32'} autoFocus />
        </label>
      ) : null}
      {ovr && (
        <label className="flex flex-col gap-1.5">
          <span className={label}>เหตุผล (≥10 ตัวอักษร)</span>
          <textarea rows={3} value={ovr.reason} onChange={(e) => onChange({ ...ovr, reason: e.target.value })} className={input} />
          <span className={`text-xs tabular-nums ${reasonLen >= 10 ? 'text-ink-3' : 'text-risk'}`}>{reasonLen} ตัวอักษร</span>
        </label>
      )}
    </Dialog>
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
  const [confirmDel, setConfirmDel] = useState<{ id: number; name: string; amount: number } | null>(null);

  if (!open) return <button onClick={() => setOpen(true)} className="btn-ghost btn-sm mt-3 -ml-2.5">จัดการงวดการเงิน →</button>;

  return (
    <div className="mt-4 rounded-lg border border-line bg-canvas p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-ink-2">
          งวดการเงิน{data && <> · จ่ายแล้ว {money(data.paid)} / {money(data.budget)} {data.burnPct != null && `(${data.burnPct}%)`}</>}
        </span>
        <button onClick={() => setOpen(false)} className="btn-ghost btn-sm">ปิด</button>
      </div>
      {data?.installments.map((it) => (
        <div key={it.id} className="flex items-center gap-3 border-t border-hair py-2 text-xs">
          <span className="flex-1">{it.name}</span>
          <span className="tabular-nums">{money(it.amount)}</span>
          <span className="tabular-nums text-ink-3">{fmtDate(it.dueDate)}</span>
          <button onClick={() => togglePaid(it.id, it.status)}
            className={`rounded-full border px-2.5 py-0.5 font-semibold ${it.status === 'PAID' ? 'border-ok-bd bg-ok-bg text-ok' : 'border-wait-bd bg-surface text-ink-2'}`}>
            {it.status === 'PAID' ? 'จ่ายแล้ว' : 'รอจ่าย'}
          </button>
          <button onClick={() => setConfirmDel({ id: it.id, name: it.name, amount: it.amount })} aria-label="ลบงวด" className="text-ink-3 hover:text-late">✕</button>
        </div>
      ))}
      <ConfirmDialog
        open={!!confirmDel}
        title={confirmDel ? `ลบงวด "${confirmDel.name}"?` : ''}
        detail={confirmDel ? `${money(confirmDel.amount)} · ${code} — ย้อนกลับไม่ได้` : undefined}
        onConfirm={() => confirmDel && del(confirmDel.id)}
        onClose={() => setConfirmDel(null)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input placeholder="ชื่องวด (งวด 1 · มัดจำ)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input + ' min-w-40 flex-1 !text-xs'} />
        <input type="number" placeholder="จำนวน" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input + ' w-28 !text-xs'} />
        <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={input + ' !text-xs'} />
        <button onClick={add} className="btn-primary btn-sm">เพิ่ม</button>
      </div>
    </div>
  );
}

// ══ Section Rules ══════════════════════════════════
const DEPTS = ['PM', 'BA', 'UXUI', 'DEV', 'QA', 'NONE'];
const BUCKETS = ['BACKLOG', 'IN_PROGRESS', 'WAITING', 'DONE', 'BLOCKED'];
const MATCH_TYPES = ['EXACT', 'CONTAINS', 'FALLBACK'];
const sel = 'rounded-md border border-line-strong bg-surface px-1.5 py-1 text-xs focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100';

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
  const [confirmDel, setConfirmDel] = useState<SectionRule | null>(null);
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
      <Toast msg={msg} onClose={() => setMsg('')} />
      {busy && <div className="mb-4 text-sm text-ink-3">กำลัง recompute…</div>}

      {unmapped.length > 0 && (
        <div className="mb-5 rounded-xl border border-late-bd bg-late-bg p-4">
          <div className="text-sm font-semibold text-late">{unmapped.length} section ยังไม่ได้ map</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {unmapped.map((u, i) => (
              <button key={i} onClick={() => mapSection(u)} className="rounded-full border border-late-bd bg-surface px-3 py-1 text-xs hover:border-late">
                {projName(u.projectId)} · {u.sectionName} <span className="text-ink-3">({u.cardCount})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {form ? (
        <div className={formBox}>
          <h3 className="mb-3 text-base font-semibold">เพิ่ม / map section rule</h3>
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
          className={btnAdd}>
          + เพิ่ม rule
        </button>
      )}

      <div className="card overflow-x-auto px-1.5 pb-2 pt-2">
      <table className="tbl min-w-[640px]">
        <thead>
          <tr>
            <th>scope</th><th>pattern</th>
            <th>dept</th><th>bucket</th>
            <th>weight</th><th>pri</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className={r.isActive ? '' : 'opacity-40'}>
              <td className="code text-ink-3">{projName(r.projectId)}</td>
              <td>{r.pattern}</td>
              <td className="pr-1"><select defaultValue={r.deptCode} onChange={(e) => editRule(r.id, { deptCode: e.target.value })} className={sel}>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select></td>
              <td className="pr-1"><select defaultValue={r.bucketCode} onChange={(e) => editRule(r.id, { bucketCode: e.target.value })} className={sel}>{BUCKETS.map((b) => <option key={b}>{b}</option>)}</select></td>
              <td className="pr-1"><input type="number" defaultValue={r.weight} onBlur={(e) => Number(e.target.value) !== r.weight && editRule(r.id, { weight: Number(e.target.value) })} className={sel + ' w-14'} /></td>
              <td className="pr-1 text-xs tabular-nums text-ink-3">{r.priority}</td>
              <td className="text-right"><button onClick={() => setConfirmDel(r)} className="text-xs text-ink-3 hover:text-late">ลบ</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <ConfirmDialog
        open={!!confirmDel}
        title={confirmDel ? `ลบ rule "${confirmDel.pattern}"?` : ''}
        detail={confirmDel ? `${projName(confirmDel.projectId)} · ${confirmDel.deptCode} / ${confirmDel.bucketCode} — ระบบจะ recompute ทันที` : undefined}
        onConfirm={() => confirmDel && removeRule(confirmDel.id)}
        onClose={() => setConfirmDel(null)}
      />
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

// ══ Users (AppUser whitelist) ══════════════════════
const ROLES: AppUserRow['role'][] = ['ADMIN', 'PM', 'VIEWER'];
const ROLE_HINT: Record<AppUserRow['role'], string> = {
  ADMIN: 'ทุกอย่าง + จัดการผู้ใช้', PM: 'ดู + ตั้งค่าโครงการ', VIEWER: 'ดูอย่างเดียว',
};

function UsersTab() {
  const me = useAuth().user;
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<{ email: string; displayName: string; role: AppUserRow['role']; boards: string[] } | null>(null);
  const boardOpts = (me?.boardCatalog ?? []).filter((b) => b.kind !== 'soon'); // ให้สิทธิ์ได้เฉพาะบอร์ดที่เปิดใช้
  const toggle = (list: string[], code: string) => (list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);

  const load = () => getUsers().then(setUsers).catch((e) => setMsg((e as Error).message));
  useEffect(() => { load(); }, []);

  // error จาก API (409 ตัวเอง / ADMIN คนสุดท้าย / อีเมลซ้ำ) → Toast แล้วโหลดใหม่ให้ select กลับค่าเดิม
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); setMsg(ok); } catch (e) { setMsg((e as Error).message); }
    load();
  };
  const saveNew = async () => {
    if (!form?.email.trim()) { setMsg('ต้องใส่อีเมล Lark'); return; }
    await run(() => createUser(form), `เพิ่ม ${form.email} แล้ว — login ด้วย Lark ได้ทันที`);
    setForm(null);
  };

  return (
    <div>
      <Toast msg={msg} onClose={() => setMsg('')} />
      <p className="mb-4 text-sm text-ink-2">
        คนที่อยู่ในรายการนี้ (และเปิดใช้งาน) เท่านั้นที่ login ด้วย Lark ได้ · ใช้อีเมลเดียวกับบัญชี Lark ของบริษัท
      </p>

      {form ? (
        <div className={formBox}>
          <h3 className="mb-3 text-base font-semibold">เพิ่มผู้ใช้</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="อีเมล Lark"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input + ' w-full'} placeholder="name@elegance.co.th" /></Field>
            <Field label="ชื่อ (ไม่ใส่ก็ได้)"><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className={input + ' w-full'} /></Field>
            <Field label="สิทธิ์">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppUserRow['role'] })} className={input + ' w-full'}>
                {ROLES.map((r) => <option key={r} value={r}>{r} — {ROLE_HINT[r]}</option>)}
              </select>
            </Field>
          </div>
          {form.role !== 'ADMIN' && (
            <div className="mt-3">
              <div className={label}>บอร์ดที่เข้าได้</div>
              <div className="mt-1 flex flex-wrap gap-4">
                {boardOpts.map((b) => (
                  <label key={b.code} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={form.boards.includes(b.code)} onChange={() => setForm({ ...form, boards: toggle(form.boards, b.code) })} />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 flex gap-3">
            <button onClick={saveNew} className={btnPrimary}>บันทึก</button>
            <button onClick={() => setForm(null)} className={btnGhost}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setForm({ email: '', displayName: '', role: 'VIEWER', boards: [] })}
          className={btnAdd}>
          + เพิ่มผู้ใช้
        </button>
      )}

      <div className="card overflow-x-auto px-1.5 pb-2 pt-2">
      <table className="tbl min-w-[760px]">
        <thead>
          <tr>
            <th>อีเมล</th><th>ชื่อ</th>
            <th>สิทธิ์</th><th>บอร์ด</th>
            <th>Lark</th><th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const self = u.id === me?.id; // แถวตัวเอง: ล็อก role + ปิดใช้งาน (กันล็อกตัวเองออก)
            return (
              <tr key={u.id} className={u.isActive ? '' : 'opacity-40'}>
                <td>{u.email}{self && <span className="ml-1.5 text-[11px] text-ink-3">(คุณ)</span>}</td>
                <td className="pr-2">
                  <input defaultValue={u.displayName} className={sel + ' w-36'}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== u.displayName && run(() => patchUser(u.id, { displayName: e.target.value }), 'แก้ชื่อแล้ว')} />
                </td>
                <td className="pr-2">
                  <select value={u.role} disabled={self} className={sel}
                    onChange={(e) => run(() => patchUser(u.id, { role: e.target.value as AppUserRow['role'] }), `เปลี่ยน ${u.email} เป็น ${e.target.value}`)}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="pr-2">
                  {u.role === 'ADMIN' ? (
                    <span className="text-xs text-ink-3">ทุกบอร์ด</span>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {boardOpts.map((b) => (
                        <label key={b.code} className="flex items-center gap-1 text-xs text-ink-2">
                          <input type="checkbox" checked={u.boards.includes(b.code)}
                            onChange={() => run(() => patchUser(u.id, { boards: toggle(u.boards, b.code) }), `อัปเดตบอร์ดของ ${u.email}`)} />
                          {b.code}
                        </label>
                      ))}
                    </div>
                  )}
                </td>
                <td className="pr-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 ${u.linked ? 'text-ok' : 'text-ink-3'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${u.linked ? 'bg-ok' : 'bg-line-strong'}`} />
                    {u.linked ? 'ผูกแล้ว' : 'ยังไม่เคย login'}
                  </span>
                </td>
                <td className="text-right">
                  {!self && (
                    <button onClick={() => run(() => patchUser(u.id, { isActive: !u.isActive }), u.isActive ? `ปิดใช้งาน ${u.email}` : `เปิดใช้งาน ${u.email}`)}
                      className={`text-xs ${u.isActive ? 'text-ink-3 hover:text-late' : 'font-medium text-brand-700 hover:underline'}`}>
                      {u.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
