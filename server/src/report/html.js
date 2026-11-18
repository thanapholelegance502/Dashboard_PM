// HTML builder แบบ escape อัตโนมัติ — ข้อความจาก Lark (ชื่อโครงการ/หัวข้อ) เข้ามาได้ทุกอย่าง
// ใครพิมพ์ <script> ในการ์ด Lark ต้องออกมาเป็นตัวอักษร ไม่ใช่โค้ดที่ Chromium รัน
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(v) {
  if (v == null) return '';
  return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

const RAW = Symbol('raw');
/** ใช้เฉพาะ HTML ที่เราสร้างเองเท่านั้น ห้ามห่อค่าที่มาจากข้อมูล */
export function raw(s) {
  return { [RAW]: true, value: String(s) };
}

function part(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(part).join('');
  if (typeof v === 'object' && v[RAW]) return v.value;
  return esc(v);
}

/** tagged template: html`<p>${userText}</p>` → escape ทุกค่า ยกเว้น raw()/html ซ้อน */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i += 1) out += part(values[i]) + strings[i + 1];
  return raw(out);
}
