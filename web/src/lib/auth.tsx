import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, type Me } from './api';
import Login from '../pages/Login';

interface AuthState {
  user: Me | null;
  reload: () => void;
}
const Ctx = createContext<AuthState>({ user: null, reload: () => {} });
export const useAuth = () => useContext(Ctx);

/** ครอบทั้งแอป — โหลด /auth/me · 401 → หน้า Login · 403 → whitelist */
export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'unauth' | 'forbidden'>('loading');

  const load = () => {
    setState('loading');
    getMe()
      .then((u) => { setUser(u); setState('ok'); })
      .catch((e) => {
        const msg = String(e.message);
        setState(msg.includes('สิทธิ์') || msg.includes('403') ? 'forbidden' : 'unauth');
      });
  };
  useEffect(load, []);

  if (state === 'loading') return <div className="p-10 text-center text-slate-400">กำลังโหลด…</div>;
  if (state === 'unauth') return <Login />;
  if (state === 'forbidden') return <Login forbidden />;
  return <Ctx.Provider value={{ user, reload: load }}>{children}</Ctx.Provider>;
}
