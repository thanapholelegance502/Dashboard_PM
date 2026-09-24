import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { useAuth } from '../lib/auth';
import type { BoardInfo } from '../lib/types';

/** หน้าแรกหลัง login — เลือกบอร์ดแผนกตามสิทธิ์ (server/src/domain/boards.js) */
export default function Landing() {
  const { user } = useAuth();
  const [noBoard, setNoBoard] = useState(false);

  // nginx ส่งกลับมา /?auth=noboard เมื่อเปิดบอร์ดแผนก (เช่น /qa/) โดยไม่มีสิทธิ์
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') !== 'noboard') return;
    setNoBoard(true);
    params.delete('auth');
    const q = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : ''));
  }, []);

  const catalog = user?.boardCatalog ?? [];
  const allowed = new Set(user?.boards ?? []);
  const mine = catalog.filter((b) => b.kind !== 'soon' && allowed.has(b.code));
  const soon = catalog.filter((b) => b.kind === 'soon');

  return (
    <AppShell title="Elegance PMO" eyebrow="เลือกบอร์ดแผนก">
      <div className="mx-auto max-w-4xl">
        {noBoard && (
          <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            คุณยังไม่มีสิทธิ์เข้าบอร์ดนั้น — ติดต่อ Admin เพื่อขอเปิดสิทธิ์
          </div>
        )}

        <p className="mb-4 text-sm text-slate-500">สวัสดี {user?.displayName} — เลือกบอร์ดที่ต้องการดู</p>

        {mine.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">ยังไม่ได้รับสิทธิ์บอร์ดใด</p>
            <p className="mt-1 text-xs text-slate-400">ติดต่อ Admin เพื่อขอเปิดสิทธิ์บอร์ดแผนกของคุณ</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((b) => <BoardCard key={b.code} board={b} />)}
          </div>
        )}

        {soon.length > 0 && (
          <>
            <h2 className="mb-3 mt-8 text-[11px] font-medium uppercase tracking-wider text-slate-400">เร็ว ๆ นี้</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {soon.map((b) => <BoardCard key={b.code} board={b} />)}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function BoardCard({ board }: { board: BoardInfo }) {
  const body = (
    <>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{board.code}</span>
      <span className="mt-1 block text-base font-semibold text-slate-900">{board.name}</span>
      <span className="mt-1 block text-sm text-slate-500">{board.desc}</span>
      {board.kind === 'soon' && <span className="mt-3 inline-block text-[11px] text-slate-400">กำลังพัฒนา</span>}
    </>
  );
  const cls = 'block rounded-xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200';
  if (board.kind === 'soon' || !board.path) return <div className={`${cls} opacity-50`}>{body}</div>;
  const hover = `${cls} transition hover:shadow-md hover:ring-slate-400`;
  // external = แอปของทีมแผนก (repo แยก) → โหลดเต็มหน้าให้ nginx เช็กสิทธิ์ + ส่งต่อ
  if (board.kind === 'external') return <a href={board.path} className={hover}>{body}</a>;
  return <Link to={board.path} className={hover}>{body}</Link>;
}
