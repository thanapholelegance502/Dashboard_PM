// OAuth + refresh token rotation (DATA-LAYER §2)
// user_access_token ในนามข้าว (ไม่ใช่ tenant token — Lark Task เชิญ bot ไม่ได้)
import { prisma } from '../db/prisma.js';
import { lark, larkPostForm, larkGet, TOKEN_INVALID_CODES } from './client.js';
import { env } from '../config/env.js';

const PROVIDER = 'lark';
// full URL — token endpoint อยู่ open.larksuite.com ไม่ใช่ open-sg (axios ใช้ absolute URL override baseURL)
const TOKEN_PATH = `${env.larkTokenBase}/authen/v2/oauth/token`;
const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh ก่อนหมดอายุ 5 นาที

export const REQUIRED_SCOPES = [
  'task:task:read',
  'task:tasklist:read',
  'task:section:read',
  'contact:contact.base:readonly',
  'contact:user.base:readonly',
  'offline_access',
];

/** สร้าง URL ให้ข้าวไป authorize ครั้งแรก
 *  หน้า login อยู่ accounts.larksuite.com (ไม่ใช่ API gateway open-sg) param = client_id */
export function buildAuthorizeUrl(state = 'setup') {
  const u = new URL(`${env.larkAuthorizeBase}/authen/v1/authorize`);
  u.searchParams.set('client_id', env.larkAppId);
  u.searchParams.set('redirect_uri', env.larkRedirectUri);
  u.searchParams.set('scope', REQUIRED_SCOPES.join(' '));
  u.searchParams.set('state', state);
  return u.toString();
}

// v2 คืน field ที่ระดับ top-level: { code, access_token, refresh_token, expires_in, ... }
function parseTokenResponse(body) {
  const d = body.data ?? body;
  const accessToken = d.access_token;
  const refreshToken = d.refresh_token;
  const expiresIn = d.expires_in; // วินาที
  if (!accessToken || !refreshToken || !expiresIn) {
    throw new Error(`token response ไม่ครบ: ${JSON.stringify(Object.keys(d))}`);
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

/** แลก authorization code → token ครั้งแรก แล้วเขียนลง DB (สำหรับ ETL — ในนามข้าว) */
export async function exchangeCodeForToken(code) {
  const body = await larkPostForm(TOKEN_PATH, {
    grant_type: 'authorization_code',
    code,
    client_id: env.larkAppId,
    client_secret: env.larkAppSecret,
    redirect_uri: env.larkRedirectUri,
  });
  const tok = parseTokenResponse(body);
  await prisma.oAuthToken.upsert({
    where: { provider: PROVIDER },
    create: { provider: PROVIDER, ...tok },
    update: tok,
  });
  return tok;
}

/**
 * SSO login: แลก code → ได้ token ของ user คนที่ login → เรียก user_info
 * ‼️ ไม่เขียน OAuthToken (นั่นเป็น token ETL ของข้าว — เขียนทับ = ETL ตาย)
 * user_info อยู่ authen family → ยิง token host (open.larksuite.com)
 */
export async function exchangeCodeForUserInfo(code) {
  const body = await larkPostForm(TOKEN_PATH, {
    grant_type: 'authorization_code',
    code,
    client_id: env.larkAppId,
    client_secret: env.larkAppSecret,
    redirect_uri: env.larkRedirectUri,
  });
  const d = body.data ?? body;
  const accessToken = d.access_token;
  if (!accessToken) throw new Error('SSO: ไม่ได้ access_token จาก code');
  const res = await lark.get(`${env.larkTokenBase}/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data?.data ?? res.data;
}

class ReauthorizeRequired extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ReauthorizeRequired';
    this.reauthorize = true;
  }
}
export { ReauthorizeRequired };

/**
 * refresh token — หมุน refresh_token ใหม่ทุกครั้ง (‼️ DATA-LAYER §2)
 * ต้องเขียนทับค่าเดิมในทรานแซกชันเดียว มิฉะนั้นระบบตายถาวร
 * ใช้ SELECT ... FOR UPDATE กัน cron กับปุ่ม Run now ชนกัน
 */
async function refreshLocked() {
  return prisma.$transaction(async (tx) => {
    // lock แถว OAuthToken (Postgres row lock)
    const rows = await tx.$queryRaw`
      SELECT id, "refreshToken", "expiresAt"
      FROM "OAuthToken" WHERE provider = ${PROVIDER} FOR UPDATE`;
    if (!rows || rows.length === 0) {
      throw new ReauthorizeRequired('ยังไม่มี token ใน DB — ต้อง authorize ก่อน (npm run lark:authorize)');
    }
    const current = rows[0];

    // อีก process อาจ refresh ไปแล้วระหว่างรอ lock → เช็คซ้ำ
    if (new Date(current.expiresAt).getTime() - Date.now() > REFRESH_SKEW_MS) {
      const fresh = await tx.oAuthToken.findUnique({ where: { provider: PROVIDER } });
      return fresh;
    }

    let body;
    try {
      body = await larkPostForm(TOKEN_PATH, {
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: env.larkAppId,
        client_secret: env.larkAppSecret,
      });
    } catch (err) {
      // refresh ล้ม → ห้ามทับ token เดิมด้วย null/ค่าพัง (DATA-LAYER §9 test)
      throw new ReauthorizeRequired(`refresh ล้มเหลว: ${err.message}`);
    }

    const tok = parseTokenResponse(body);
    // เขียนทับทันทีในทรานแซกชันเดียวกัน
    const updated = await tx.oAuthToken.update({
      where: { provider: PROVIDER },
      data: tok,
    });
    return updated;
  });
}

/** คืน access_token ที่ยังไม่หมดอายุ — refresh อัตโนมัติถ้าใกล้หมด */
export async function ensureAccessToken() {
  const tok = await prisma.oAuthToken.findUnique({ where: { provider: PROVIDER } });
  if (!tok) {
    throw new ReauthorizeRequired('ยังไม่มี token — รัน npm run lark:authorize ก่อน');
  }
  if (tok.expiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
    return tok.accessToken;
  }
  const refreshed = await refreshLocked();
  return refreshed.accessToken;
}

/**
 * GET ที่ handle token invalid: ถ้าเจอ 99991668 → refresh 1 ครั้ง แล้ว retry 1 ครั้ง
 * ถ้ายังพัง → โยน ReauthorizeRequired (DATA-LAYER §4)
 */
export async function authedGet(path, params) {
  let token = await ensureAccessToken();
  try {
    return await larkGet(path, params, token);
  } catch (err) {
    if (err.larkCode && TOKEN_INVALID_CODES.has(err.larkCode)) {
      const refreshed = await refreshLocked();
      token = refreshed.accessToken;
      try {
        return await larkGet(path, params, token);
      } catch (err2) {
        if (err2.larkCode && TOKEN_INVALID_CODES.has(err2.larkCode)) {
          throw new ReauthorizeRequired(`token ใช้ไม่ได้หลัง refresh: ${err2.message}`);
        }
        throw err2;
      }
    }
    throw err;
  }
}
