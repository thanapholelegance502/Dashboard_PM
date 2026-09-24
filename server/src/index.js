import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { attachUser, requireAuth, requireBoard } from './api/middleware/auth.js';
import { errorHandler } from './api/middleware/error.js';
import { syncRouter } from './api/routes/sync.js';
import { authRouter } from './api/routes/auth.js';
import { metaRouter } from './api/routes/meta.js';
import { pmRouter } from './api/routes/pm.js';
import { adminRouter } from './api/routes/admin.js';
import { startCron } from './jobs/cron.js';
import { createSessionStore } from './db/sessionStore.js';

export function createApp() {
  const app = express();
  if (env.trustProxy) app.set('trust proxy', 1); // อยู่หลัง nginx → เชื่อ X-Forwarded-*
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      store: createSessionStore(), // Postgres — restart/deploy แล้วไม่หลุด (H-1)
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true, // ใช้งานอยู่ = ต่ออายุ · ไม่เข้าเกิน 7 วันต้อง login ใหม่
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.cookieSecure, // secure=true บน production (https)
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );
  app.use(attachUser);

  app.use('/api/auth', authRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/meta', metaRouter);
  // บอร์ด: /api/pm/finance = C-level · ที่เหลือ = PM (กัน tester ที่มีแค่ QA ยิง API การเงินตรง ๆ)
  const pmBoardGuard = (req, res, next) => requireBoard(req.path.startsWith('/finance') ? 'CLEVEL' : 'PM')(req, res, next);
  app.use('/api/pm', requireAuth, pmBoardGuard, pmRouter);
  app.use('/api/admin', requireAuth, adminRouter);

  app.use(errorHandler);
  return app;
}

// start เฉพาะตอนรันตรง (ไม่ใช่ตอน import ใน test)
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[server] http://localhost:${env.port} (AUTH_MODE=${env.authMode})`);
    startCron();
  });
}
