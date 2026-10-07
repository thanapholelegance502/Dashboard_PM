// Scheduler — cron 08:00 และ 17:00 Asia/Bangkok (MASTER §8, DATA-LAYER §5)
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runSync } from '../etl/runSync.js';
import { writeSnapshot } from '../etl/snapshot.js';
import { isYokEnabled } from '../config/env.js';
import { runYokSync } from '../sheets/yokSource.js';

export function startCron() {
  const opts = { timezone: 'Asia/Bangkok' };

  // 08:00 — sync เฉยๆ
  cron.schedule(
    env.cronMorning,
    async () => {
      try {
        await runSync({ trigger: 'CRON' });
      } catch (err) {
        console.error('[cron 08:00] sync ล้มเหลว:', err.message);
      }
    },
    opts
  );

  // 17:00 — sync แล้วต่อด้วย writeSnapshot
  cron.schedule(
    env.cronEvening,
    async () => {
      try {
        await runSync({ trigger: 'CRON' });
        await writeSnapshot();
      } catch (err) {
        console.error('[cron 17:00] sync/snapshot ล้มเหลว:', err.message);
      }
    },
    opts
  );

  // บอร์ด YOK — กวาด Google Sheet คนละเวลากับ Lark (09:00/17:00)
  if (isYokEnabled()) {
    for (const [label, expr] of [['เช้า', env.yokCronMorning], ['เย็น', env.yokCronEvening]]) {
      cron.schedule(
        expr,
        async () => {
          try {
            await runYokSync({ trigger: 'CRON' });
          } catch (err) {
            console.error(`[cron yok ${label}] ล้มเหลว:`, err.message);
          }
        },
        opts
      );
    }
    console.log(`[cron] yok: morning="${env.yokCronMorning}" evening="${env.yokCronEvening}"`);
  }

  console.log(`[cron] ตั้งเวลา: morning="${env.cronMorning}" evening="${env.cronEvening}" (Asia/Bangkok)`);
}
