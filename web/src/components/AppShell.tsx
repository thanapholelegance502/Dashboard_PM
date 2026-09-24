import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { logout } from '../lib/api';

interface Props {
  title: string;
  eyebrow?: string; // แถบเล็กเหนือ title เช่น "UAT · Go-Live · Timeline · Status"
  asOf?: string | null; // ข้อความมุมขวา เช่น "16 Sep 2025"
  tagline?: string;
  children: React.ReactNode;
}

// board = ต้องมีสิทธิ์บอร์ดนั้น (domain/boards.js) · roles = ต้องมี role นั้น
const navItems: { to: string; label: string; board?: string; roles?: string[] }[] = [
  { to: '/', label: 'หน้าแรก' },
  { to: '/pm', label: 'Portfolio', board: 'PM' },
  { to: '/finance', label: 'การเงิน', board: 'CLEVEL' },
  { to: '/admin', label: 'ตั้งค่า', roles: ['ADMIN', 'PM'] }, // VIEWER เข้าหน้าตั้งค่าไม่ได้ (backend 403)
];

export default function AppShell({ title, eyebrow, asOf, tagline, children }: Props) {
  const { user } = useAuth();
  const items = navItems.filter(
    (n) => (!n.roles || (user && n.roles.includes(user.role))) && (!n.board || user?.boards.includes(n.board)),
  );
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* header navy */}
      <header className="bg-[#1e3a5f] text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight tracking-tight md:text-xl">{title}</h1>
            {eyebrow && <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-white/50">{eyebrow}</div>}
          </div>
          <div className="flex items-center gap-5">
            <nav className="hidden items-center gap-4 text-sm md:flex">
              {items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) => `border-b-2 pb-0.5 transition ${isActive ? 'border-white font-medium text-white' : 'border-transparent text-white/60 hover:text-white'}`}
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <div className="text-right">
              {asOf && <div className="text-[11px] text-white/50">As of</div>}
              {asOf && <div className="text-sm font-semibold">{asOf}</div>}
              {tagline && <div className="text-[11px] text-white/50">{tagline}</div>}
            </div>
            <UserChip />
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex gap-4 border-t border-white/10 px-5 py-2 text-sm md:hidden">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'font-medium text-white' : 'text-white/60')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">{children}</main>

      {/* footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm">
          <span className="font-semibold text-slate-700">On Time · On Quality · On Business Value</span>
          <span className="text-slate-400">Elegance PMO · <span className="italic">From Plan to Impact</span></span>
        </div>
      </footer>
    </div>
  );
}

function UserChip() {
  const { user } = useAuth();
  const doLogout = async () => { try { await logout(); } catch { /* ignore */ } window.location.reload(); };
  return (
    <div className="flex items-center gap-2 border-l border-white/20 pl-4 text-xs">
      <span className="hidden text-white/80 sm:inline">{user?.displayName ?? '—'}</span>
      <button onClick={doLogout} className="text-white/50 hover:text-white">ออก</button>
    </div>
  );
}
