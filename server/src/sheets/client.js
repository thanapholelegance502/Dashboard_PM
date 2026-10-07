// Google Sheets HTTP client — ชั้นเดียวที่คุยกับ Sheets API (คู่กับ lark/client.js)
// base URL ตั้งที่เดียวตรงนี้ · ห้าม log token / เนื้อข้อมูลในชีต
import axios from 'axios';
import { env } from '../config/env.js';
import { getSheetsToken, dropSheetsToken } from './auth.js';

export const sheets = axios.create({
  baseURL: env.sheetsApiHost, // https://sheets.googleapis.com/v4
  timeout: 20000,
});

sheets.interceptors.request.use((cfg) => {
  cfg.metadata = { start: Date.now() };
  return cfg;
});
sheets.interceptors.response.use(
  (res) => {
    const ms = Date.now() - (res.config.metadata?.start ?? Date.now());
    console.log(`[sheets] ${res.config.method?.toUpperCase()} ${res.config.url} ${res.status} ${ms}ms`);
    return res;
  },
  (err) => {
    const cfg = err.config ?? {};
    const ms = Date.now() - (cfg.metadata?.start ?? Date.now());
    console.log(`[sheets] ${cfg.method?.toUpperCase?.()} ${cfg.url} ${err.response?.status ?? 'ERR'} ${ms}ms`);
    return Promise.reject(err);
  }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function googleReason(err) {
  const d = err.response?.data?.error;
  return d?.errors?.[0]?.reason ?? d?.status ?? '';
}

/**
 * แยกประเภท error ของ Google — ‼️ Google คืน 403 (ไม่ใช่ 429) สำหรับ per-user quota
 * ไม่ดักข้อนี้ = เจอ quota แล้วเลิกเลยทั้งที่ควร retry
 */
export function classifySheetsError(err) {
  const status = err.response?.status;
  const reason = googleReason(err);

  if (status === 403) {
    if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded' || reason === 'RESOURCE_EXHAUSTED') {
      return { retry: true };
    }
    return { retry: false, flag: 'sheetAccess' }; // ถูกถอดสิทธิ์ / un-share ก่อนเวลา
  }
  if (status === 429) return { retry: true };
  if (status === 404) return { retry: false, flag: 'sheetMissing' };
  if (status === 400) return { retry: false, flag: 'sheetTabMissing' }; // range ชี้ tab ที่ไม่มี
  if (status === 401 || reason === 'invalid_grant') return { retry: false, flag: 'sheetAuth' };
  if (status >= 500) return { retry: true };
  if (['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) return { retry: true };
  return { retry: false };
}

/** GET + bearer token + exponential backoff (แบบเดียวกับ larkGet) */
export async function sheetsGet(path, params) {
  const maxRetries = 5;
  let attempt = 0;
  let authRetried = false;
  for (;;) {
    try {
      const token = await getSheetsToken();
      const res = await sheets.get(path, {
        params,
        headers: { Authorization: `Bearer ${token}` },
        paramsSerializer: { indexes: null }, // ranges=a&ranges=b (ไม่ใส่ [])
      });
      return res.data;
    } catch (err) {
      const { retry, flag } = classifySheetsError(err);

      // token เน่า → ทิ้งแล้วลองใหม่ครั้งเดียว
      if (flag === 'sheetAuth' && !authRetried) {
        authRetried = true;
        dropSheetsToken();
        continue;
      }
      if (retry && attempt < maxRetries) {
        attempt += 1;
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      if (flag) err[flag] = true;
      throw err;
    }
  }
}

/** ดึงหลาย tab ในครั้งเดียว — UNFORMATTED_VALUE → วันที่เป็น serial, เงินเป็นตัวเลข ไม่ต้องเดา locale */
export async function batchGetValues(spreadsheetId, tabNames) {
  const body = await sheetsGet(`/spreadsheets/${spreadsheetId}/values:batchGet`, {
    // quote ชื่อ tab เสมอ กันชื่อที่มีเว้นวรรค
    ranges: tabNames.map((t) => `'${String(t).replace(/'/g, "''")}'`),
    majorDimension: 'ROWS',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  const out = {};
  (body.valueRanges ?? []).forEach((vr, i) => {
    out[tabNames[i]] = vr.values ?? [];
  });
  return out;
}

/** รายชื่อ tab + gid (ใช้ทำลิงก์ลึกกลับไปที่ cell และบอกว่า tab ถูก rename) */
export async function getSheetTabs(spreadsheetId) {
  const body = await sheetsGet(`/spreadsheets/${spreadsheetId}`, {
    fields: 'sheets.properties(title,sheetId)',
  });
  return (body.sheets ?? []).map((s) => ({ title: s.properties.title, gid: s.properties.sheetId }));
}
