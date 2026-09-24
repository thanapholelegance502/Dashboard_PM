// Auth routes — Lark SSO (MASTER §7) + authorize flow ครั้งแรก (DATA-LAYER §2)
import { Router } from 'express';
import { authProvider } from '../auth/provider.js';
import { BOARDS, effectiveBoards, canAccessBoard } from '../../domain/boards.js';
import { classifyCallback } from '../../domain/oauthState.js';
import { exchangeCodeForToken } from '../../lark/auth.js';
import { writeAudit } from '../../domain/audit.js';

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

const escapeHtml = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** หน้าโชว์ code ให้ก็อบไปรัน CLI (flow `npm run lark:authorize`) — ไม่แลก code เอง */
const cliCodePage = (code) => `<!doctype html><meta charset="utf-8"><title>Lark authorize</title>
<body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:0 16px">
<h3>ได้ code แล้ว — ก็อบไปรันบน server ภายใน ~1 นาที</h3>
<pre style="background:#f1f5f9;padding:12px;white-space:pre-wrap;word-break:break-all">docker compose -f docker-compose.prod.yml exec server npm run lark:authorize -- --code ${escapeHtml(code)}</pre>
<p style="color:#64748b">ทางที่ง่ายกว่า: ADMIN กดปุ่ม "เชื่อม Lark ใหม่" ในหน้าตั้งค่า (ไม่ต้องใช้ server)</p></body>`;

// GET /api/auth/callback → แยก flow ตาม state (domain/oauthState.js)
//   etl = ปุ่ม "เชื่อม Lark ใหม่" ของ ADMIN · cli = npm run lark:authorize · login = SSO
authRouter.get('/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'ไม่มี code' });

    const kind = classifyCallback({
      state,
      sessionState: req.session?.larkEtlState,
      isAdmin: req.user?.role === 'ADMIN',
    });
    if (kind === 'cli') return res.type('html').send(cliCodePage(code));
    if (kind === 'reject') return res.redirect('/admin?lark=failed');
    if (kind === 'etl') {
      delete req.session.larkEtlState; // ใช้ครั้งเดียว
      try {
        const tok = await exchangeCodeForToken(String(code));
        await writeAudit({
          appUserId: req.user.id, entity: 'OAuthToken', entityId: 'lark', action: 'UPDATE',
          after: { expiresAt: tok.expiresAt }, reason: 'เชื่อม Lark ใหม่จากหน้าตั้งค่า',
        });
        return res.redirect('/admin?lark=connected');
      } catch (err) {
        console.error('[auth] แลก code เป็น token ETL ล้มเหลว:', err.message);
        return res.redirect('/admin?lark=failed');
      }
    }

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
