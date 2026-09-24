// Auth routes — Lark SSO (MASTER §7) + authorize flow ครั้งแรก (DATA-LAYER §2)
import { Router } from 'express';
import { authProvider } from '../auth/provider.js';
import { BOARDS, effectiveBoards, canAccessBoard } from '../../domain/boards.js';

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
    // login แล้วพากลับหน้าเว็บ (SPA) → AuthGate เช็ก session ผ่าน /me → เข้า dashboard
    // (เดิมตอบ JSON ทำให้ค้างที่หน้า /api/auth/callback)
    res.redirect('/');
  } catch (err) {
    // ไม่อยู่ใน whitelist → พาไปหน้า 🚫 ของ SPA แทน JSON error ดิบ
    if (err.status === 403) return res.redirect('/?auth=forbidden');
    next(err);
  }
});

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'ต้อง login' });
  const { id, email, displayName, role } = req.user;
  // boardCatalog = ทะเบียนบอร์ดจาก domain/boards.js (หน้า landing + แท็บผู้ใช้ใช้ชุดเดียวกัน ไม่ต้อง hardcode ซ้ำฝั่ง web)
  res.json({ id, email, displayName, role, boards: effectiveBoards(req.user), boardCatalog: BOARDS });
});

// GET /api/auth/check?board=QA — nginx auth_request เรียกก่อนเปิดแอปแผนก (/qa/…)
// 401 = ยังไม่ login · 403 = ไม่มีสิทธิ์บอร์ดนี้ · 204 = ผ่าน + ส่งตัวตนให้แอปแผนกผ่าน header
authRouter.get('/check', (req, res) => {
  if (!req.user) return res.sendStatus(401);
  if (!canAccessBoard(req.user, req.query.board)) return res.sendStatus(403);
  res.set('X-Portal-User', req.user.email);
  res.set('X-Portal-Role', req.user.role);
  res.sendStatus(204);
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  if (req.session) req.session.destroy(() => {});
  res.json({ ok: true });
});
