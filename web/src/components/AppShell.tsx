import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { logout } from '../lib/api';
import type { BoardInfo } from '../lib/types';

interface Props {
  title: string;
  eyebrow?: string; // บรรทัดรองใต้ title เช่น "UAT · Go-Live · Timeline · Status"
  asOf?: string | null; // เวลาข้อมูล เช่น "24 ก.ย. 69 · 09:30 น."
  stale?: boolean; // sync เก่ากว่า 24 ชม. → pill แดง (§11)
  tagline?: string;
  actions?: React.ReactNode; // ปุ่มมุมขวาของ header (Sync now ฯลฯ)
  children: React.ReactNode;
}

const linkCls = (active: boolean) =>
  `flex items-center rounded-lg px-2.5 py-2 text-sm transition ${active ? 'bg-[#243756] font-medium text-white' : 'text-[#C9D3E3] hover:bg-white/5 hover:text-white'}`;

export default function AppShell({ title, eyebrow, asOf, stale, tagline, actions, children }: Props) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  // บอร์ดทั้งหมดมาจาก boardCatalog (server/src/domain/boards.js) — ลำดับ + กลุ่มเดียวกับหน้าแรก
  // ไม่ hardcode ชื่อบอร์ดฝั่ง web อีก (เคยต้องแก้ 2 ที่แล้วชื่อไม่ตรงกัน)
  const catalog = user?.boardCatalog ?? [];
  const groups = user?.boardGroups ?? [];
  const allowed = new Set(user?.boards ?? []);
  const visible = (b: BoardInfo) => (b.kind === 'soon' ? true : allowed.has(b.code) && !!b.path);
  // กลุ่มที่ไม่มีบอร์ดให้เห็นเลย → ซ่อนหัวกลุ่มด้วย ไม่ปล่อยหัวลอย ๆ
  // ‼️ บอร์ด "เร็ว ๆ นี้" ไม่นับว่าทำให้กลุ่มมีของ (VIEWER ที่มีแค่การเงินต้องไม่เห็นหัว "แผนก" เพราะ UX/UI)
  const grouped = groups
    .map((g) => ({ ...g, boards: catalog.filter((b) => b.group === g.key && visible(b)) }))
    .filter((g) => g.boards.some((b) => b.kind !== 'soon'));
  const canSettings = !!user && ['ADMIN', 'PM'].includes(user.role); // VIEWER เข้าหน้าตั้งค่าไม่ได้ (backend 403)

  const boardItem = (b: BoardInfo) => {
    if (b.kind === 'soon') {
      return (
        <span key={b.code} className="flex items-center px-2.5 py-2 text-sm text-[#6F819E]">
          {b.name}
          <span className="ml-auto text-[11px]">เร็ว ๆ นี้</span>
        </span>
      );
    }
    // external = แอปทีมแผนกที่ nginx วางไว้ใต้ path → โหลดเต็มหน้า (ให้ nginx เช็กสิทธิ์)
    if (b.kind === 'external') {
      return (
        <a key={b.code} href={b.path} className={linkCls(false)}>
          {b.name}
          <span className="ml-auto font-mono text-[11px] text-[#6F819E]">{b.path}</span>
        </a>
      );
    }
    return (
      <NavLink key={b.code} to={b.path!} onClick={close} className={({ isActive }) => linkCls(isActive)}>
        {b.name}
      </NavLink>
    );
  };

  const nav = (
    <>
      <NavLink to="/" end onClick={close} className={({ isActive }) => linkCls(isActive)}>
        หน้าแรก
      </NavLink>
      {grouped.map((g) => (
        <div key={g.key} className="flex flex-col gap-1">
          <span className="px-2.5 pb-1 pt-3 text-[11px] tracking-wider text-[#6F819E]">{g.label}</span>
          {g.boards.map(boardItem)}
        </div>
      ))}
    </>
  );

  // ตั้งค่าไม่ใช่บอร์ด → แยกไว้ล่างสุด เหนือชื่อผู้ใช้
  const settings = canSettings ? (
    <NavLink to="/admin" onClick={close} className={({ isActive }) => linkCls(isActive)}>
      ตั้งค่า
    </NavLink>
  ) : null;

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      {/* sidebar (desktop) */}
      <aside className="no-print hidden bg-brand-900 lg:block">
        <div className="sticky top-0 flex h-screen flex-col gap-1 overflow-y-auto px-3 py-5">
          <Brand />
          <nav className="flex flex-col gap-1">{nav}</nav>
          <div className="mt-auto flex flex-col gap-1 pt-4">
            {settings}
            <UserChip />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* top bar (mobile) */}
        <div className="no-print bg-brand-900 text-white lg:hidden">
          <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
            <Logo size="sm" />
            <span className="truncate text-[15px] font-semibold">Elegance PMO</span>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="เมนู"
              aria-expanded={menuOpen}
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none hover:bg-white/10"
            >
              {menuOpen ? '✕' : '≡'}
            </button>
          </div>
          {menuOpen && (
            <nav className="flex flex-col gap-1 border-t border-[#243756] px-3 pb-3 pt-1">
              {nav}
              <div className="mt-3 flex flex-col gap-1">
                {settings}
                <UserChip />
              </div>
            </nav>
          )}
        </div>

        {/* page header */}
        <header className="border-b border-line bg-canvas">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 md:px-7 md:pb-4 md:pt-5">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight tracking-tight md:text-2xl">{title}</h1>
              {eyebrow && <div className="mt-0.5 text-[13px] text-ink-3">{eyebrow}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 md:ml-auto">
              {asOf && (
                <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-2">
                  <span className={`h-[7px] w-[7px] rounded-full ${stale ? 'bg-late' : 'bg-ok'}`} />
                  ข้อมูล ณ {asOf}
                </span>
              )}
              {stale && (
                <span className="inline-flex items-center gap-2 rounded-full border border-late-bd bg-late-bg px-3 py-1.5 text-xs font-semibold text-late">
                  ข้อมูลเก่ากว่า 24 ชม.
                </span>
              )}
              {actions}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 md:px-7">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs md:px-7">
            <span className="font-semibold text-ink-2">On Time · On Quality · On Business Value</span>
            <span className="text-ink-3">
              Elegance PMO · <span className="italic">From Plan to Impact</span>
              {tagline && <> · {tagline}</>}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-6 w-6 rounded-md text-xs' : 'h-7 w-7 rounded-[7px] text-sm';
  return <span className={`flex shrink-0 items-center justify-center bg-white font-bold text-brand-900 ${s}`}>E</span>;
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2 pb-5">
      <Logo />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-white">Elegance PMO</span>
        <span className="text-[11px] text-[#8FA0BA]">Lark Task → Dashboard</span>
      </div>
    </div>
  );
}

function UserChip() {
  const { user } = useAuth();
  const doLogout = async () => { try { await logout(); } catch { /* ignore */ } window.location.reload(); };
  const name = user?.displayName ?? '—';
  return (
    <div className="mt-auto flex items-center gap-2.5 border-t border-[#243756] px-2.5 pt-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2E4468] text-xs text-white">
        {name.slice(0, 2)}
      </span>
      <div className="flex min-w-0 flex-col text-xs">
        <span className="truncate text-white">{name}</span>
        <span className="text-[#6F819E]">{user?.role}</span>
      </div>
      <button onClick={doLogout} className="ml-auto rounded-md px-2 py-1 text-xs text-[#9FB0C8] hover:bg-white/10 hover:text-white">
        ออก
      </button>
    </div>
  );
}
