// renderPdf — mock puppeteer (test:ci ไม่มี Chromium) · ตรวจกติกาความปลอดภัย + ชนิดผลลัพธ์
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = { js: null, intercept: null, handlers: {}, closed: 0 };
let pdfImpl = async () => new Uint8Array([37, 80, 68, 70, 45]); // "%PDF-" แบบที่ puppeteer 24 คืนจริง

vi.mock('puppeteer-core', () => ({
  default: {
    launch: async () => ({
      process: () => null,
      close: async () => { calls.closed += 1; },
      newPage: async () => ({
        setJavaScriptEnabled: async (v) => { calls.js = v; },
        setRequestInterception: async (v) => { calls.intercept = v; },
        on: (ev, fn) => { calls.handlers[ev] = fn; },
        setContent: async () => {},
        evaluateHandle: async () => {},
        pdf: () => pdfImpl(),
      }),
    }),
  },
}));

const { renderPdf, RenderBusyError } = await import('../src/report/pdf.js');

beforeEach(() => {
  calls.js = null; calls.intercept = null; calls.handlers = {}; calls.closed = 0;
  pdfImpl = async () => new Uint8Array([37, 80, 68, 70, 45]);
});

describe('renderPdf', () => {
  it('‼️ คืน Buffer เสมอ (puppeteer 24 คืน Uint8Array → Express ส่งเป็น JSON ถ้าไม่แปลง)', async () => {
    const out = await renderPdf('<p>x</p>');
    expect(Buffer.isBuffer(out)).toBe(true);
    expect(out.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('‼️ ปิด JavaScript + บล็อกทุก request ยกเว้น data: (ข้อความจาก Lark อยู่ในหน้า)', async () => {
    await renderPdf('<p>x</p>');
    expect(calls.js).toBe(false);
    expect(calls.intercept).toBe(true);
    const req = (url) => ({ url: () => url, continue: vi.fn(), abort: vi.fn() });
    const data = req('data:font/woff2;base64,AAA');
    const meta = req('http://169.254.169.254/latest/meta-data');
    const ext = req('https://evil.example/x.png');
    calls.handlers.request(data); calls.handlers.request(meta); calls.handlers.request(ext);
    expect(data.continue).toHaveBeenCalled();
    expect(meta.abort).toHaveBeenCalled();
    expect(ext.abort).toHaveBeenCalled();
  });

  it('ปิด Chromium ทุกครั้ง แม้สร้าง PDF ล้ม', async () => {
    pdfImpl = async () => { throw new Error('boom'); };
    await expect(renderPdf('<p>x</p>')).rejects.toThrow('boom');
    expect(calls.closed).toBe(1);
    pdfImpl = async () => new Uint8Array([1]);
    await renderPdf('<p>y</p>'); // ล้มแล้วคิวต้องว่าง ไม่ค้าง
    expect(calls.closed).toBe(2);
  });

  it('ทีละ 1 ไฟล์ · คิวรอได้ 2 · เกินนั้น 503', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    pdfImpl = async () => { await gate; return new Uint8Array([1]); };
    const a = renderPdf('a'); const b = renderPdf('b'); const c = renderPdf('c');
    await expect(renderPdf('d')).rejects.toBeInstanceOf(RenderBusyError);
    release();
    await Promise.all([a, b, c]);
  });
});
