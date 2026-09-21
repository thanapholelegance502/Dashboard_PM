// AuthProvider interface + 2 implementation (MASTER §7)
// dev → auto-login ADMIN · lark_sso → Lark OAuth (whitelist only)
// ออกแบบให้สลับด้วย env ไม่ต้องรื้อโค้ด
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { buildAuthorizeUrl, exchangeCodeForUserInfo } from '../../lark/auth.js';

/** @typedef {{ id:number, email:string, displayName:string, role:string }} SessionUser */

class DevAuth {
  mode = 'dev';
  /** auto-login เป็น AppUser id 1 (role ADMIN) */
  async getUser() {
    let user = await prisma.appUser.findFirst({ orderBy: { id: 'asc' } });
    if (!user) {
      user = await prisma.appUser.create({
        data: { email: 'dev@local', displayName: 'Dev Admin', role: 'ADMIN' },
      });
    }
    return user;
  }
  getLoginRedirect() {
    return null; // dev ไม่ต้อง redirect
  }
  async handleCallback() {
    return null;
  }
}

class LarkSsoAuth {
  mode = 'lark_sso';
  getLoginRedirect(state = 'login') {
    return buildAuthorizeUrl(state);
  }
  /** แลก code → open_id/email → หา AppUser (whitelist, ไม่ auto-create)
   *  ‼️ ใช้ exchangeCodeForUserInfo (ไม่เขียนทับ OAuth token ETL ของข้าว) */
  async handleCallback(code) {
    const info = await exchangeCodeForUserInfo(code);
    const openId = info.open_id;
    const email = info.email ?? info.enterprise_email;
    let user = null;
    if (openId) user = await prisma.appUser.findUnique({ where: { larkOpenId: openId } });
    if (!user && email) user = await prisma.appUser.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      const e = new Error('ไม่พบสิทธิ์ (whitelist only) — ติดต่อ Admin');
      e.status = 403;
      throw e;
    }
    // ผูก open_id ถ้ายังไม่ผูก
    if (openId && !user.larkOpenId) {
      user = await prisma.appUser.update({ where: { id: user.id }, data: { larkOpenId: openId } });
    }
    return user;
  }
  async getUser() {
    return null; // มาจาก session cookie แทน
  }
}

export const authProvider = env.authMode === 'lark_sso' ? new LarkSsoAuth() : new DevAuth();
