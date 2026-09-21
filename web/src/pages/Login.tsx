import { loginUrl } from '../lib/api';

export default function Login({ forbidden }: { forbidden?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-lg font-bold">Elegance PMO Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Project Portfolio — Executive</p>

        {forbidden ? (
          <div className="mt-6">
            <div className="mb-2 text-3xl">🚫</div>
            <p className="text-sm text-delayed">บัญชี Lark ของคุณยังไม่มีสิทธิ์เข้าระบบ</p>
            <p className="mt-1 text-xs text-slate-400">ติดต่อ Admin เพื่อขอเปิดสิทธิ์</p>
            <a href={loginUrl} className="mt-4 inline-block text-xs text-doing hover:underline">
              ลองเข้าด้วยบัญชีอื่น
            </a>
          </div>
        ) : (
          <a
            href={loginUrl}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-doing px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            เข้าสู่ระบบด้วย Lark
          </a>
        )}

        <p className="mt-4 text-[11px] text-slate-400">ใช้บัญชี Lark ของบริษัท ไม่ต้องตั้งรหัสใหม่</p>
      </div>
    </div>
  );
}
