// Users batch — แปลง open_id → ชื่อ (DATA-LAYER §3.3)
import { authedGet } from './auth.js';

/** chunk array เป็นก้อนละ n */
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * ดึงข้อมูล user ทีละก้อน ≤50 id (DATA-LAYER §3.3)
 * @param {string[]} openIds
 * @returns {Promise<Array<{open_id, name, ...}>>}
 */
export async function fetchUsersByOpenId(openIds, get = authedGet) {
  const unique = [...new Set(openIds.filter(Boolean))];
  const users = [];
  for (const ids of chunk(unique, 50)) {
    const body = await get('/contact/v3/users/batch', {
      user_id_type: 'open_id',
      user_ids: ids, // client serialize เป็น user_ids=a&user_ids=b
    });
    users.push(...(body.data?.items ?? []));
  }
  return users;
}
