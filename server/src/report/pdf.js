// HTML → PDF ด้วย Chromium headless
// ‼️ VPS RAM 1–2 GB: เปิด Chromium เฉพาะตอนสร้างแล้วปิดทันที · ทำได้ทีละ 1 ไฟล์ (คิวไม่เกิน 2)
// ‼️ HTML มีข้อความจาก Lark: ปิด JavaScript + บล็อก request ทุกตัวยกเว้น data: (กันดึงของนอก/metadata)
import { env } from '../config/env.js';

const MAX_WAITING = 2;
let running = false;
const waiting = [];

export class RenderBusyError extends Error {
  constructor() {
    super('กำลังสร้างรายงานอื่นอยู่ ลองใหม่ในอีกสักครู่');
    this.status = 503;
  }
}

async function acquire() {
  if (!running) {
    running = true;
    return;
  }
  if (waiting.length >= MAX_WAITING) throw new RenderBusyError();
  await new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else running = false;
}

/** html (เอกสารเต็ม) → Buffer PDF A4 */
export async function renderPdf(html, { footerUrl = '' } = {}) {
  // footer ว่าง = ไม่มี PUBLIC_BASE_URL → ไม่โชว์ลิงก์เสีย (เช่น "/pm") แค่ชื่อองค์กร
  const safeUrl = String(footerUrl).replace(/[<>"&]/g, '');
  if (!safeUrl) console.warn('[weekly-report] PUBLIC_BASE_URL ว่าง — PDF ไม่แสดงลิงก์กลับ dashboard');
  const footerLeft = safeUrl
    ? `Elegance PMO · ตรวจสอบตัวเลขได้ที่ ${safeUrl}`
    : 'Elegance PMO · On Time · On Quality · On Business Value';
  await acquire();
  let browser;
  const timeoutMs = env.pdfRenderTimeoutMs;
  const killer = setTimeout(() => {
    try { browser?.process()?.kill('SIGKILL'); } catch { /* ignore */ }
  }, timeoutMs);
  try {
    // import ตอนใช้ — test:ci / เครื่องที่ไม่มี Chromium จะไม่โหลด puppeteer เลย
    const { default: puppeteer } = await import('puppeteer-core');
    browser = await puppeteer.launch({
      executablePath: env.chromiumPath,
      headless: true,
      args: [
        '--no-sandbox', // container รันเป็น root · กันไว้ด้วยการปิด JS + บล็อก network ข้างล่าง
        '--disable-dev-shm-usage', // /dev/shm ของ Docker มีแค่ 64 MB
        '--disable-gpu',
        '--disable-extensions',
        '--font-render-hinting=none',
      ],
    });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => (req.url().startsWith('data:') ? req.continue() : req.abort()));
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    await page.evaluateHandle('document.fonts.ready').catch(() => {});
    // ‼️ puppeteer 24 คืน Uint8Array ไม่ใช่ Buffer — Express res.send(Uint8Array) จะส่งเป็น JSON
    //    และไฟล์แนบ nodemailer ก็เพี้ยนได้ → แปลงเป็น Buffer ที่นี่ที่เดียว
    const out = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate:
        // footer ไม่เห็นฟอนต์ที่ฝังในหน้า → ใช้ฟอนต์ไทยของเครื่อง (server: fonts-thai-tlwg = Loma/Sarabun)
        '<div style="font-family:Sarabun,Loma,Thonburi,sans-serif;font-size:8.5px;color:#4A4E57;width:100%;padding:0 12mm;display:flex;justify-content:space-between">'
        + `<span>${footerLeft}</span>`
        + '<span>หน้า <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
    });
    return Buffer.from(out);
  } finally {
    clearTimeout(killer);
    await browser?.close().catch(() => {});
    release();
  }
}
