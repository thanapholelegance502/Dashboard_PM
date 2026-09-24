import { loginUrl } from '../lib/api';

export default function Login({ forbidden }: { forbidden?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* แผงแบรนด์ */}
      <div className="flex flex-col justify-between gap-8 bg-brand-900 px-6 py-8 text-white lg:px-14 lg:py-12">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-base font-bold text-brand-900">E</span>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold">Elegance PMO</span>
            <span className="text-[11px] text-[#8FA0BA]">Lark Task → Dashboard</span>
          </div>
        </div>
        <div className="hidden lg:block">
          <p className="text-3xl font-semibold leading-snug">On Time · On Quality<br />· On Business Value</p>
          <p className="mt-3 text-sm text-[#9FB0C8]">From Plan to Impact</p>
        </div>
        <span className="hidden text-xs text-[#6F819E] lg:block">Elegance PMO · Deliver Projects. Create Business Value.</span>
      </div>

      {/* ฟอร์ม */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="card w-full max-w-sm p-7">
          <h1 className="text-xl font-semibold">Elegance PMO Dashboard</h1>
          <p className="mt-1 text-sm text-ink-3">Project Portfolio — Executive</p>

          {forbidden ? (
            <div className="mt-6 flex flex-col gap-1.5 rounded-lg border border-late-bd bg-late-bg p-4">
              <span className="flex items-center gap-2 text-sm font-semibold text-late">
                <span className="h-2 w-2 rounded-full bg-late" />
                บัญชี Lark ของคุณยังไม่มีสิทธิ์เข้าระบบ
              </span>
              <p className="text-xs text-ink-2">ติดต่อ Admin เพื่อขอเปิดสิทธิ์</p>
              <a href={loginUrl} className="mt-1 text-[13px] font-semibold hover:underline">
                ลองเข้าด้วยบัญชีอื่น
              </a>
            </div>
          ) : (
            <a href={loginUrl} className="btn-primary mt-6 w-full py-2.5 text-sm hover:text-white">
              เข้าสู่ระบบด้วย Lark
            </a>
          )}

          <p className="mt-4 text-xs text-ink-3">ใช้บัญชี Lark ของบริษัท ไม่ต้องตั้งรหัสใหม่</p>
        </div>
      </div>
    </div>
  );
}
