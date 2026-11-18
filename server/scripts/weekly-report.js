#!/usr/bin/env node
// รายงานรายสัปดาห์ (บอร์ด PM/KHAW) จาก command line
//   --out report.pdf          สร้างไฟล์อย่างเดียว ไม่ส่ง (ค่าเริ่มต้นที่ปลอดภัย)
//   --html report.html        เขียน HTML (ไม่ต้องมี Chromium) ไว้ดูหน้าตา
//   --to me@company           ส่งถึงอีเมลเดียวที่ระบุ (ต้องอยู่ MAIL_ALLOWED_DOMAIN)
//   --verify-smtp             เช็ค login SMTP ได้ไหม (ไม่ส่งอะไร)
//   --resend-scheduled --yes  ส่งถึงผู้รับจริงซ้ำ (เช่นศุกร์ที่แล้วล้ม) · production เท่านั้น · --force ข้ามกันส่งซ้ำ
import { writeFileSync } from 'node:fs';
import { env } from '../src/config/env.js';
import { getPmBoardSummary } from '../src/services/pmBoard.js';
import { buildReportModel, renderReportHtml } from '../src/report/weeklyReport.js';
import { generateWeeklyReport, sendWeeklyReport } from '../src/report/sendWeekly.js';
import { verifySmtp } from '../src/mail/mailer.js';

const args = process.argv.slice(2);
const val = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
};
const has = (flag) => args.includes(flag);

async function main() {
  if (has('--verify-smtp')) {
    await verifySmtp();
    console.log('SMTP login ได้ ✓ (ยังไม่ได้ส่งอะไร)');
    return;
  }
  if (val('--html')) {
    const now = new Date();
    const m = buildReportModel(await getPmBoardSummary({ now }), { baseUrl: env.publicBaseUrl || 'http://localhost:5173', now });
    writeFileSync(val('--html'), renderReportHtml(m));
    console.log(`เขียน HTML → ${val('--html')}`);
    return;
  }
  if (val('--to')) {
    const r = await sendWeeklyReport({ kind: 'CLI_TO', override: val('--to') });
    console.log('ส่งแล้ว', r);
    return;
  }
  if (has('--resend-scheduled')) {
    if (!has('--yes')) throw new Error('ส่งถึงผู้รับจริง — ต้องใส่ --yes ยืนยัน');
    const r = await sendWeeklyReport({ kind: 'SCHEDULED', force: has('--force') });
    console.log('ผล', r);
    return;
  }
  const out = val('--out') ?? 'weekly-report.pdf';
  const { pdf, model } = await generateWeeklyReport({ now: new Date() });
  writeFileSync(out, pdf);
  console.log(`เขียน PDF → ${out} (${pdf.length} bytes) · ข้อมูล: ${model.freshness.level} · ไม่ได้ส่งเมล`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ล้มเหลว:', e.message);
    process.exit(1);
  });
