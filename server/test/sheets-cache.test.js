import { describe, it, expect, vi } from 'vitest';
import { createTtlCache } from '../src/sheets/cache.js';

const TTL = 60_000;
function harness(fetcher, opts = {}) {
  let t = 1_000_000;
  const cache = createTtlCache({ ttlMs: TTL, fetcher, now: () => t, ...opts });
  return { cache, advance: (ms) => { t += ms; }, at: () => t };
}

describe('createTtlCache', () => {
  it('ดึงครั้งแรก แล้วเสิร์ฟจาก memory จนหมดอายุ', async () => {
    const fetcher = vi.fn(async () => ({ n: 1 }));
    const { cache, advance } = harness(fetcher);

    const a = await cache.get();
    expect(a.data).toEqual({ n: 1 });
    expect(a.stale).toBe(false);

    advance(TTL - 1);
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(1); // ยังไม่หมดอายุ

    advance(2);
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('‼️ ดึงใหม่ล้ม → เสิร์ฟ lastGood + stale และไม่ทับของเดิม (MASTER §12.4)', async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error('google down');
      return { n: 1 };
    });
    const { cache, advance } = harness(fetcher);

    await cache.get();
    fail = true;
    advance(TTL + 1);

    const r = await cache.get();
    expect(r.data).toEqual({ n: 1 }); // ของเดิมยังอยู่
    expect(r.stale).toBe(true);
    expect(r.staleReason).toBeTruthy();

    // หายดีแล้วกลับมาปกติ
    fail = false;
    advance(60_000);
    const ok = await cache.get();
    expect(ok.stale).toBe(false);
  });

  it('cold start + ล้ม (ไม่มี lastGood) → throw 503 ไม่ใช่ payload ว่าง', async () => {
    const fetcher = vi.fn(async () => { throw new Error('google down'); });
    const { cache } = harness(fetcher);
    await expect(cache.get()).rejects.toMatchObject({ status: 503 });
  });

  it('staleReason แยกตามชนิด error — ถูกถอดสิทธิ์ต้องไม่อ่านเหมือนเน็ตล่ม', async () => {
    const cases = [
      [{ sheetAccess: true }, /สิทธิ์/],
      [{ sheetMissing: true }, /ไม่พบชีต/],
      [{ sheetTabMissing: true }, /แท็บ/],
      [{}, /Google/],
    ];
    for (const [flags, re] of cases) {
      let fail = false;
      const fetcher = vi.fn(async () => {
        if (fail) throw Object.assign(new Error('x'), flags);
        return { n: 1 };
      });
      const { cache, advance } = harness(fetcher);
      await cache.get();
      fail = true;
      advance(TTL + 1);
      const r = await cache.get();
      expect(r.stale).toBe(true);
      expect(r.staleReason, JSON.stringify(flags)).toMatch(re);
    }
  });

  it('‼️ single-flight — get() 5 ครั้งพร้อมกัน ยิง fetcher ครั้งเดียว', async () => {
    let resolve;
    const gate = new Promise((r) => { resolve = r; });
    const fetcher = vi.fn(async () => { await gate; return { n: 1 }; });
    const { cache } = harness(fetcher);

    const all = Promise.all([cache.get(), cache.get(), cache.get(), cache.get(), cache.get()]);
    resolve();
    const rs = await all;

    expect(fetcher).toHaveBeenCalledTimes(1);
    for (const r of rs) expect(r.data).toEqual({ n: 1 });
  });

  it('ล้มแล้วเว้น backoff ก่อนยิงใหม่ — ไม่ถล่ม Google ทุก request', async () => {
    let fail = false;
    const fetcher = vi.fn(async () => {
      if (fail) throw new Error('down');
      return { n: 1 };
    });
    const { cache, advance } = harness(fetcher);
    await cache.get();
    fail = true;
    advance(TTL + 1);
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(2);

    await cache.get();
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(2); // ยังอยู่ใน backoff

    advance(31_000);
    await cache.get();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('‼️ 200 แต่ข้อมูลว่างผิดปกติ → เก็บ lastGood + degraded (failure ที่หน้าตาเหมือนสำเร็จ)', async () => {
    let empty = false;
    const fetcher = vi.fn(async () => (empty ? { rows: [] } : { rows: [1, 2, 3] }));
    const { cache, advance } = harness(fetcher, { isSuspect: (d) => d.rows.length === 0 });

    await cache.get();
    empty = true;
    advance(TTL + 1);

    const r = await cache.get();
    expect(r.data).toEqual({ rows: [1, 2, 3] });
    expect(r.degraded).toBe(true);
    expect(r.stale).toBe(true);
  });

  it('cold start + ข้อมูลว่าง (ไม่มี lastGood) → ยอมรับไปก่อน ไม่ throw', async () => {
    const fetcher = vi.fn(async () => ({ rows: [] }));
    const { cache } = harness(fetcher, { isSuspect: (d) => d.rows.length === 0 });
    const r = await cache.get();
    expect(r.data).toEqual({ rows: [] });
  });

  it('peek ไม่ยิง network', async () => {
    const fetcher = vi.fn(async () => ({ n: 1 }));
    const { cache } = harness(fetcher);
    expect(cache.peek()).toBeNull();
    await cache.get();
    expect(cache.peek().data).toEqual({ n: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
