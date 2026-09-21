// Auth routes — Lark SSO (MASTER §7) + authorize flow ครั้งแรก (DATA-LAYER §2)
import { Router } from 'express';
import { authProvider } from '../auth/provider.js';

export const authRouter = Router();

// GET /api/auth/login → redirect ไป Lark authorize (sso) หรือ no-op (dev)
authRouter.get('/login', (req, res, next) => {
  try {
    const url = authProvider.getLoginRedirect('login');
    if (!url) return res.json({ mode: 'dev', message: 'dev mode: auto-login ADMIN' });
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/callback → แลก code → set session
authRouter.get('/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'ไม่มี code' });
    const user = await authProvider.handleCallback(String(code));
    if (user && req.session) req.session.userId = user.id;
    res.json({ ok: true, user: user ? { id: user.id, role: user.role } : null });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'ต้อง login' });
  const { id, email, displayName, role } = req.user;
  res.json({ id, email, displayName, role });
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  if (req.session) req.session.destroy(() => {});
  res.json({ ok: true });
});
