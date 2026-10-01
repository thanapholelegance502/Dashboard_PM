// Stage pipeline ของบอร์ด YOK — ลำดับอยู่ที่นี่ที่เดียว (funnel + "ไปถึงขั้นไหนแล้ว" อ่านจากตัวนี้)
export const YOK_STAGES = Object.freeze([
  'Sales process',
  'Waiting for Client',
  'PM - Planning',
  'Requirement & Analysis',
  'UXUI - Design',
  'Development',
  'Ready for Deploy',
  'Ready for Test',
  'Testing',
  'Ready for UAT',
  'UAT',
  'Ready for PROD',
  'PROD',
]);

/** ตัดเว้นวรรค/ขีด/จุด ออกให้หมด → 'PM - Planning' ≡ 'PM-Planning' ≡ 'pm planning' */
function key(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s\-_.&]/g, '');
}

const BY_KEY = new Map(YOK_STAGES.map((s, i) => [key(s), i]));

/** index 0..12 หรือ null */
export function stageIndex(raw) {
  const k = key(raw);
  return k && BY_KEY.has(k) ? BY_KEY.get(k) : null;
}

/**
 * stage ที่ไม่รู้จัก → เก็บ label เดิมไว้ + ติดธง unknown
 * (แถวหายไปเพราะหยกพิมพ์ stage ใหม่ แย่กว่าขึ้นป้ายว่าไม่รู้จัก)
 */
export function normalizeStage(raw) {
  const label = raw == null || String(raw).trim() === '' ? null : String(raw).trim();
  if (label == null) return { code: null, label: null, index: null, unknown: false };
  const i = stageIndex(label);
  if (i == null) return { code: null, label, index: null, unknown: true };
  return { code: YOK_STAGES[i], label: YOK_STAGES[i], index: i, unknown: false };
}
