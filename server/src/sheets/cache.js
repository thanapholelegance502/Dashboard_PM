// TTL cache + serve-stale-on-error (MASTER §12.4 — upstream ล้ม ห้ามล้างของเดิม)
// pure-ish: ฉีด now เข้ามาเพื่อ test ด้วย fake timer ได้

const FAIL_BACKOFF_MS = 30_000; // ล้มแล้วเว้นก่อนยิงใหม่ กัน request storm ตอน Google ล่ม

/**
 * @param {object}   o
 * @param {number}   o.ttlMs
 * @param {Function} o.fetcher  async () => data
 * @param {Function} [o.now]
 * @param {Function} [o.isSuspect] (data) => boolean — 200 แต่ข้อมูลว่างผิดปกติ
 */
export function createTtlCache({ ttlMs, fetcher, now = () => Date.now(), isSuspect = null }) {
  let lastGood = null;
  let lastGoodAt = 0;
  let lastErrorAt = 0;
  let staleReason = null;
  let degraded = false;
  let inFlight = null; // single-flight — หลายคนเปิดพร้อมกันต้องยิง Google ครั้งเดียว

  function snapshot(stale) {
    return {
      data: lastGood,
      asOf: new Date(lastGoodAt).toISOString(),
      ageSec: Math.max(0, Math.round((now() - lastGoodAt) / 1000)),
      stale,
      ...(stale && staleReason ? { staleReason } : {}),
      ...(degraded ? { degraded: true } : {}),
    };
  }

  async function refresh() {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const data = await fetcher();
        if (isSuspect && isSuspect(data) && lastGood) {
          // 200 แต่ข้อมูลว่างผิดปกติ = failure ที่หน้าตาเหมือนสำเร็จ → เก็บของเดิมไว้
          degraded = true;
          staleReason = 'ดึงข้อมูลได้แต่ว่างผิดปกติ · แสดงข้อมูลรอบก่อน';
          lastErrorAt = now();
          return snapshot(true);
        }
        lastGood = data;
        lastGoodAt = now();
        staleReason = null;
        degraded = false;
        return snapshot(false);
      } catch (err) {
        lastErrorAt = now();
        staleReason = err.sheetAccess
          ? 'ไม่มีสิทธิ์เข้าถึงชีต (ถูกถอดสิทธิ์?)'
          : err.sheetMissing
            ? 'ไม่พบชีต'
            : err.sheetTabMissing
              ? 'ไม่พบแท็บในชีต (ถูกเปลี่ยนชื่อ?)'
              : 'ดึงข้อมูลจาก Google ไม่สำเร็จ';
        // ‼️ ไม่แตะ lastGood — ความล้มเหลวห้ามทับข้อมูลรอบก่อน
        if (lastGood) return snapshot(true);
        err.status = err.status ?? 503;
        throw err;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  return {
    async get() {
      const age = now() - lastGoodAt;
      if (lastGood && age < ttlMs) return snapshot(false);
      // เพิ่งล้มไป → เสิร์ฟของเดิมก่อน อย่าเพิ่งไปรบ Google ซ้ำ
      if (lastGood && lastErrorAt && now() - lastErrorAt < FAIL_BACKOFF_MS) return snapshot(true);
      return refresh();
    },
    /** ค่าปัจจุบันโดยไม่ยิง network (ใช้ใน /meta) */
    peek() {
      return lastGood ? snapshot(now() - lastGoodAt >= ttlMs) : null;
    },
    invalidate() {
      lastGoodAt = 0;
      lastErrorAt = 0;
    },
  };
}
