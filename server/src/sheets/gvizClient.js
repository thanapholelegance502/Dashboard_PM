// อ่าน Google Sheet ผ่าน gviz (endpoint เดียวกับที่เว็บเดิมของหยกใช้ แต่ยิงจาก server)
// ‼️ วิธีนี้ทำงานได้เฉพาะตอนชีตแชร์เป็น "anyone with the link"
//    = ปิดชีตไม่ได้ ตราบใดที่ยังใช้ทางนี้ · ทางที่ปิดชีตได้คือ client.js (service account)
//    สลับด้วย env YOK_SOURCE=gviz | api (ดู docs/YOK-BOARD.md)
import axios from 'axios';
import { env } from '../config/env.js';

const GVIZ_BASE = 'https://docs.google.com/spreadsheets/d';

export const gviz = axios.create({ timeout: 20000 });

gviz.interceptors.request.use((cfg) => {
  cfg.metadata = { start: Date.now() };
  return cfg;
});
gviz.interceptors.response.use(
  (res) => {
    const ms = Date.now() - (res.config.metadata?.start ?? Date.now());
    // log แค่ชื่อแท็บ + status — ห้าม log เนื้อข้อมูล (ชีตมีชื่อลูกค้าจริง)
    console.log(`[gviz] ${res.config.params?.sheet ?? '?'} ${res.status} ${ms}ms`);
    return res;
  },
  (err) => {
    console.log(`[gviz] ${err.config?.params?.sheet ?? '?'} ${err.response?.status ?? 'ERR'}`);
    return Promise.reject(err);
  }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** gviz ห่อ JSON ไว้ใน /*O_o*\/\ngoogle.visualization.Query.setResponse({...}); */
export function parseGvizBody(text) {
  const open = text.indexOf('{');
  const close = text.lastIndexOf('}');
  if (open === -1 || close === -1) {
    const e = new Error('gviz ตอบกลับไม่ใช่ JSON ที่อ่านได้ (ชีตอาจไม่ได้เปิดสาธารณะ)');
    e.sheetAccess = true;
    throw e;
  }
  let body;
  try {
    body = JSON.parse(text.slice(open, close + 1));
  } catch {
    const e = new Error('gviz ตอบกลับ JSON เสีย');
    e.sheetAccess = true;
    throw e;
  }
  if (body.status === 'error') {
    const reason = body.errors?.[0]?.reason ?? '';
    const msg = body.errors?.[0]?.detailed_message ?? body.errors?.[0]?.message ?? reason;
    const e = new Error(`gviz error: ${String(msg).replace(/<[^>]+>/g, '').trim()}`);
    // ชีตถูกปิด / ไม่มีสิทธิ์ → ต้องแยกจาก "แท็บไม่มี" ให้ชัด
    if (reason === 'accessDenied' || /permission|access/i.test(String(msg))) e.sheetAccess = true;
    else if (/invalid_query|sheet/i.test(String(msg))) e.sheetTabMissing = true;
    throw e;
  }
  return body;
}

/**
 * cell ของ gviz เป็น { v, f } · วันที่มาเป็น string "Date(2026,8,28)" (เดือนนับจาก 0)
 * คืนค่าดิบให้ชั้น parse จัดการต่อ — ที่นี่แปลงแค่รูปทรง
 */
function cellValue(c) {
  if (c == null) return '';
  const v = c.v;
  if (v == null) return '';
  return v;
}

/** table ของ gviz → แถวแบบ array (รวมแถวหัวตาราง เพราะเรียกด้วย headers=0) */
export function gvizTableToRows(table) {
  const rows = (table?.rows ?? []).map((r) => (r.c ?? []).map(cellValue));
  // headers=0 แล้ว gviz ยังอาจยัดหัวตารางไว้ใน cols[].label — ถ้ามี ให้เป็นแถวแรก
  const labels = (table?.cols ?? []).map((c) => c.label ?? '');
  if (labels.some((l) => String(l).trim() !== '')) rows.unshift(labels);
  return rows;
}

async function fetchTab(spreadsheetId, tabName) {
  const maxRetries = 3;
  let attempt = 0;
  for (;;) {
    try {
      const res = await gviz.get(`${GVIZ_BASE}/${spreadsheetId}/gviz/tq`, {
        params: { tqx: 'out:json', sheet: tabName, headers: 0, tq: 'select *' },
        responseType: 'text',
        transformResponse: [(d) => d],
      });
      return gvizTableToRows(parseGvizBody(res.data).table);
    } catch (err) {
      if (err.sheetAccess || err.sheetTabMissing) throw err;
      const status = err.response?.status;
      const retriable = status === 429 || status >= 500 || ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET'].includes(err.code);
      if (retriable && attempt < maxRetries) {
        attempt += 1;
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      if (status === 404) err.sheetMissing = true;
      throw err;
    }
  }
}

/** ดึงหลายแท็บ — gviz ไม่มี batch จึงยิงทีละตัว (cron วันละ 2 รอบ ไม่เป็นปัญหา) */
export async function gvizGetTabs(tabNames, spreadsheetId = env.yokSheetId) {
  const out = {};
  for (const name of tabNames) {
    try {
      out[name] = await fetchTab(spreadsheetId, name);
    } catch (err) {
      if (err.sheetTabMissing) {
        out[name] = null; // แท็บไม่มี/ถูก rename → ให้ชั้นบนขึ้น warning ไม่ใช่ทำทั้งรอบพัง
        continue;
      }
      throw err; // ปิดชีต/ชีตหาย = ทั้งรอบใช้ไม่ได้
    }
  }
  return out;
}
