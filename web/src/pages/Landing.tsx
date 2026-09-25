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
      <div className="max-w-5xl">
        {noBoard && (
          <div className="mb-5 rounded-lg border border-late-bd bg-late-bg px-4 py-3 text-sm text-late">
            คุณยังไม่มีสิทธิ์เข้าบอร์ดนั้น — ติดต่อ Admin เพื่อขอเปิดสิทธิ์
          </div>
        )}

        <p className="mb-4 text-sm text-ink-2">สวัสดี {user?.displayName} — เลือกบอร์ดที่ต้องการดู</p>

        {mine.length === 0 ? (
          <div className="card flex flex-col gap-1.5 p-5">
            <div className="rounded-lg bg-surface-2 p-4">
              <p className="text-sm font-semibold">ยังไม่ได้รับสิทธิ์บอร์ดใด</p>
              <p className="mt-1 text-xs text-ink-2">ติดต่อ Admin เพื่อขอเปิดสิทธิ์บอร์ดแผนกของคุณ</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((b) => <BoardCard key={b.code} board={b} />)}
          </div>
        )}

        {soon.length > 0 && (
          <>
            <h2 className="mb-3 mt-8 text-xs font-medium tracking-wider text-ink-3">เร็ว ๆ นี้</h2>
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
      <span className="flex items-center gap-2">
        <span className="code rounded bg-surface-2 px-1.5 py-0.5 text-ink-2">{board.code}</span>
        {board.kind === 'external' && board.path && <span className="font-mono text-[11px] text-ink-3">{board.path}</span>}
      </span>
      <span className="mt-3 block text-base font-semibold text-ink">{board.name}</span>
      <span className="mt-1 block text-sm text-ink-2">{board.desc}</span>
      {board.kind === 'soon' ? (
        <span className="mt-4 inline-block text-xs text-ink-3">กำลังพัฒนา</span>
      ) : (
        <span className="mt-4 inline-block text-[13px] font-semibold text-brand-700">เปิดบอร์ด →</span>
      )}
    </>
  );
  const cls = 'card block p-5 text-left';
  if (board.kind === 'soon' || !board.path) return <div className={`${cls} opacity-60`}>{body}</div>;
  const hover = `${cls} transition hover:border-brand-700 hover:shadow-hover`;
  // external = แอปของทีมแผนก (repo แยก) → โหลดเต็มหน้าให้ nginx เช็กสิทธิ์ + ส่งต่อ
  if (board.kind === 'external') return <a href={board.path} className={hover}>{body}</a>;
  return <Link to={board.path} className={hover}>{body}</Link>;
}
