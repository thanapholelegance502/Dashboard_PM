// Tasklist / sections / tasks (DATA-LAYER §3)
// จุดที่ Genspark พัง: pagination หยุดก่อนครบ → ต้องวนจน has_more=false เท่านั้น
import { authedGet } from './auth.js';

/**
 * ดึง sections ทั้งหมดของ 1 tasklist → Map<sectionGuid, sectionName>
 * @param {string} guid tasklist_guid
 * @param {(path:string, params:object)=>Promise<any>} [get] inject ได้เพื่อ test
 */
export async function fetchSections(guid, get = authedGet) {
  const sections = new Map();
  let pageToken;
  let pages = 0;
  let hasMore;
  do {
    // endpoint จริง = /task/v2/sections + query param (สเปก §3.1 เขียน path param ผิด → 404)
    const body = await get('/task/v2/sections', {
      resource_type: 'tasklist',
      resource_id: guid,
      page_size: 100,
      page_token: pageToken,
    });
    const data = body.data ?? {};
    for (const s of data.items ?? []) {
      sections.set(s.guid, s.name);
    }
    pageToken = data.page_token;
    hasMore = data.has_more === true;
    pages += 1;
    if (pages > 200) throw new Error(`pagination runaway (sections): ${guid}`);
  } while (hasMore && pageToken);
  return sections;
}

/**
 * ดึง tasks ทั้งหมด — วนทุก section แล้ว list ต่อ section (DATA-LAYER §3.2)
 * เหตุผล: tasklist list endpoint คืน task แบบย่อ ไม่มี field tasklists → หา section ไม่ได้
 *         list ต่อ section ทำให้รู้ sectionGuid แน่นอน + แก้ปัญหาการ์ดข้ามหลาย tasklist ในตัว
 * ห้ามหยุดเพราะ items.length < page_size · ห้ามหยุดเพราะได้ครบจำนวนที่คาด
 * @param {Map<string,string>} sectionMap guid→name
 * @returns {{tasks: any[], pages: number}} task แต่ละใบแนบ _sectionGuid/_sectionName
 */
export async function fetchAllTasks(sectionMap, get = authedGet) {
  const out = [];
  const seen = new Set(); // dedup กันการ์ดโผล่หลาย section ในบอร์ดเดียว
  let pages = 0;
  for (const [sectionGuid, sectionName] of sectionMap) {
    let pageToken;
    let hasMore;
    do {
      const body = await get(`/task/v2/sections/${sectionGuid}/tasks`, {
        page_size: 100,
        page_token: pageToken,
      });
      const data = body.data ?? {};
      for (const item of data.items ?? []) {
        if (seen.has(item.guid)) continue;
        seen.add(item.guid);
        out.push({ ...item, _sectionGuid: sectionGuid, _sectionName: sectionName });
      }
      pageToken = data.page_token;
      hasMore = data.has_more === true;
      pages += 1;
      if (pages > 500) throw new Error('pagination runaway (section tasks)'); // กัน loop ไม่จบ
    } while (hasMore && pageToken); // ← เงื่อนไขหยุดคือ has_more เท่านั้น
  }
  return { tasks: out, pages };
}
