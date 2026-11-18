// ใครได้รับรายงาน — ด่านเดียวที่ทุกทาง (cron / ปุ่มทดสอบ / CLI) ต้องผ่าน
// ‼️ กติกา: ส่งถึงผู้รับจริง (WEEKLY_REPORT_TO) ได้เฉพาะ production + เปิดสวิตช์แล้วเท่านั้น
//    ทดสอบส่งได้แค่ "อีเมลของคนที่กด" · ทุกคนต้องอยู่โดเมนบริษัท (กันพิมพ์ผิดส่งออกนอก)
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export class RecipientError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/** "a@x.com, B@x.com ,a@x.com" → ตัดช่องว่าง/ตัวพิมพ์ใหญ่/ซ้ำ · คัดตัวที่ไม่ใช่อีเมลหรือผิดโดเมนออก */
export function parseRecipients(csv, { allowedDomain, max = 10 } = {}) {
  const domain = String(allowedDomain ?? '').toLowerCase().replace(/^@/, '');
  const seen = new Set();
  const list = [];
  const invalid = [];
  for (const raw of String(csv ?? '').split(/[,;\n]/)) {
    const e = raw.trim().toLowerCase();
    if (!e) continue;
    if (!EMAIL_RE.test(e) || (domain && !e.endsWith(`@${domain}`))) {
      invalid.push(e);
      continue;
    }
    if (seen.has(e)) continue;
    seen.add(e);
    list.push(e);
  }
  if (list.length > max) throw new RecipientError(`ผู้รับเกิน ${max} คน`);
  return { list, invalid };
}

/**
 * @param kind 'SCHEDULED' (cron) | 'TEST' (ปุ่มส่งถึงตัวเอง) | 'CLI_TO' (npm script --to)
 * @returns string[] — throw เมื่อไม่ผ่านด่าน (ไม่คืน list ว่างแบบเงียบ ๆ)
 */
export function resolveRecipients({ kind, env, user = null, override = null }) {
  const opts = { allowedDomain: env.mailAllowedDomain };
  if (!env.mailAllowedDomain) throw new RecipientError('ยังไม่ได้ตั้ง MAIL_ALLOWED_DOMAIN');

  if (kind === 'SCHEDULED') {
    if (env.nodeEnv !== 'production') throw new RecipientError('ส่งถึงผู้รับจริงได้เฉพาะ production');
    if (!env.weeklyReportEnabled) throw new RecipientError('ยังไม่ได้เปิด WEEKLY_REPORT_ENABLED');
    const { list, invalid } = parseRecipients(env.weeklyReportTo, opts);
    if (invalid.length) throw new RecipientError(`WEEKLY_REPORT_TO มีอีเมลไม่ถูกต้อง/ผิดโดเมน ${invalid.length} รายการ`);
    if (!list.length) throw new RecipientError('WEEKLY_REPORT_TO ว่าง');
    return list;
  }

  if (kind === 'TEST') {
    // โหมด dev ทุกคนถูก auto-login เป็น user ปลอม → "ส่งถึงตัวผม" จะไปผิดคน
    if (env.authMode === 'dev') throw new RecipientError('ส่งทดสอบไม่ได้ในโหมด AUTH_MODE=dev');
    const { list, invalid } = parseRecipients(user?.email, opts);
    if (invalid.length || list.length !== 1) throw new RecipientError('อีเมลของบัญชีนี้ไม่อยู่ในโดเมนที่อนุญาต');
    return list;
  }

  if (kind === 'CLI_TO') {
    const { list, invalid } = parseRecipients(override, opts);
    if (invalid.length || list.length !== 1) throw new RecipientError('--to ต้องเป็นอีเมลเดียวในโดเมนที่อนุญาต');
    return list; // ‼️ ไม่รวม WEEKLY_REPORT_TO เด็ดขาด
  }

  throw new RecipientError(`ไม่รู้จักประเภทการส่ง: ${kind}`);
}

/** ปิดบังอีเมลก่อนแสดงในหน้าตั้งค่า: someone@x.com → s***@x.com */
export function maskEmail(e) {
  const [u, d] = String(e).split('@');
  return d ? `${u.slice(0, 1)}***@${d}` : '***';
}
