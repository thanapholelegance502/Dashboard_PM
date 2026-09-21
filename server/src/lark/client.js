// Lark HTTP client — ชั้นเดียวที่คุยกับ Lark (DATA-LAYER §1, §4)
// base URL ตั้งที่เดียวตรงนี้ ห้ามเขียน host เต็มกระจายในโค้ด
import axios from 'axios';
import { env } from '../config/env.js';

export const lark = axios.create({
  baseURL: env.larkApiHost, // https://open-sg.larksuite.com/open-apis
  timeout: 20000,
});

// log ทุก request แบบ { method, path, status, ms } — ห้าม log token/secret (DATA-LAYER §4)
lark.interceptors.request.use((cfg) => {
  cfg.metadata = { start: Date.now() };
  return cfg;
});
lark.interceptors.response.use(
  (res) => {
    const ms = Date.now() - (res.config.metadata?.start ?? Date.now());
    console.log(`[lark] ${res.config.method?.toUpperCase()} ${res.config.url} ${res.status} ${ms}ms`);
    return res;
  },
  (err) => {
    const cfg = err.config ?? {};
    const ms = Date.now() - (cfg.metadata?.start ?? Date.now());
    const status = err.response?.status ?? 'ERR';
    console.log(`[lark] ${cfg.method?.toUpperCase?.()} ${cfg.url} ${status} ${ms}ms`);
    return Promise.reject(err);
  }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lark error code ที่แปลว่า token ใช้ไม่ได้ (DATA-LAYER §4)
export const TOKEN_INVALID_CODES = new Set([99991668, 99991663, 99991661]);

function isRateLimited(err) {
  if (err.response?.status === 429) return true;
  const code = err.response?.data?.code;
  return code === 99991400 || code === 11232; // rate limit family
}

/**
 * GET พร้อม auth header + exponential backoff (429/5xx/timeout)
 * ไม่ handle token refresh ที่นี่ — auth.js เป็นคน wrap (แยก concern)
 * @param {string} path เช่น /task/v2/tasklists/{guid}/tasks
 * @param {object} params query params
 * @param {string} accessToken user_access_token
 */
export async function larkGet(path, params, accessToken) {
  const maxRetries = 5;
  let attempt = 0;
  // exponential backoff 1s → 2s → 4s → 8s (สูงสุด 5 ครั้ง) — DATA-LAYER §4
  for (;;) {
    try {
      const res = await lark.get(path, {
        params,
        headers: { Authorization: `Bearer ${accessToken}` },
        paramsSerializer: { indexes: null }, // user_ids=a&user_ids=b (ไม่ใส่ [])
      });
      const body = res.data;
      if (body && typeof body.code === 'number' && body.code !== 0) {
        const e = new Error(`lark_api_error code=${body.code} msg=${body.msg}`);
        e.larkCode = body.code;
        e.response = res;
        // rate limit code → retry, token invalid → โยนให้ auth.js จัดการ
        if ((body.code === 99991400 || body.code === 11232) && attempt < maxRetries) {
          attempt += 1;
          await sleep(1000 * 2 ** (attempt - 1));
          continue;
        }
        throw e;
      }
      return body;
    } catch (err) {
      if (err.larkCode) throw err;
      const retriable = isRateLimited(err) || err.code === 'ECONNABORTED' || (err.response?.status >= 500);
      if (retriable && attempt < maxRetries) {
        attempt += 1;
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      throw err;
    }
  }
}

/** POST (ใช้กับ OAuth token endpoint) — ไม่มี auth header */
export async function larkPostForm(path, data) {
  const res = await lark.post(path, data, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  const body = res.data;
  if (body && typeof body.code === 'number' && body.code !== 0) {
    const e = new Error(`lark_oauth_error code=${body.code} msg=${body.msg}`);
    e.larkCode = body.code;
    throw e;
  }
  return body;
}
