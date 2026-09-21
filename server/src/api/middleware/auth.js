// Auth + role middleware (MASTER §7)
import { authProvider } from '../auth/provider.js';
import { prisma } from '../../db/prisma.js';

/** แนบ req.user — dev = auto ADMIN · sso = จาก session */
export async function attachUser(req, _res, next) {
  try {
    if (authProvider.mode === 'dev') {
      req.user = await authProvider.getUser();
    } else if (req.session?.userId) {
      req.user = await prisma.appUser.findUnique({ where: { id: req.session.userId } });
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'ต้อง login' });
  next();
}

/** requireRole('ADMIN', 'PM') */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'ต้อง login' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'สิทธิ์ไม่พอ' });
    }
    next();
  };
}
