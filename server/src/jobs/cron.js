// Scheduler — cron 08:00 และ 17:00 Asia/Bangkok (MASTER §8, DATA-LAYER §5)
import cron from 'node-cron';
import { env } from '../config/env.js';
import { runSync } from '../etl/runSync.js';
import { writeSnapshot } from '../etl/snapshot.js';
import { isYokEnabled, isWeeklyReportEnabled } from '../config/env.js';
import { sendWeeklyReport } from '../report/sendWeekly.js';
import { prisma } from '../db/prisma.js';
import { todayDateStrBkk } from '../domain/time.js';
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

  // รายงานรายสัปดาห์ (บอร์ด PM/KHAW) — ศุกร์ 17:30 หลัง sync 17:00
  if (isWeeklyReportEnabled()) {
    cron.schedule(
      env.weeklyReportCron,
      async () => {
        try {
          await waitForRunningSync();
          // sync ควรสำเร็จหลัง 16:50 วันนี้ (รอบ 17:00) — ไม่ถึงก็ยังส่ง แต่ขึ้นแถบเตือนในเมล/PDF
          const expectSince = new Date(`${todayDateStrBkk(new Date())}T16:50:00+07:00`);
          await sendWeeklyReport({ kind: 'SCHEDULED', expectSince });
        } catch (err) {
          console.error('[cron weekly-report] ล้มเหลว:', err.message);
        }
      },
      opts
    );
    console.log(`[cron] weekly report: "${env.weeklyReportCron}" (Asia/Bangkok)`);
  }

  console.log(`[cron] ตั้งเวลา: morning="${env.cronMorning}" evening="${env.cronEvening}" (Asia/Bangkok)`);
}

/** sync 17:00 ยังรันอยู่ → รอสูงสุด 20 นาที (ไม่สั่ง sync เอง — กัน lock ชน/token Lark) */
async function waitForRunningSync(maxMin = 20) {
  for (let i = 0; i < maxMin; i += 1) {
    const last = await prisma.syncRun.findFirst({ orderBy: { startedAt: 'desc' } });
    if (last?.status !== 'RUNNING') return;
    await new Promise((r) => setTimeout(r, 60_000));
  }
}
