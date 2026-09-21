// CLI: npm run sync:once — ยิง sync 1 รอบ (+ snapshot ถ้าใส่ --snapshot) สำหรับ verify
import { runSync } from '../src/etl/runSync.js';
import { writeSnapshot } from '../src/etl/snapshot.js';
import { prisma } from '../src/db/prisma.js';

const withSnapshot = process.argv.includes('--snapshot');

try {
  const result = await runSync({ trigger: 'MANUAL' });
  console.log('[sync] result:', {
    status: result.status,
    tasksFetched: result.tasksFetched,
    pagesFetched: result.pagesFetched,
    projectsOk: result.projectsOk,
    projectsFail: result.projectsFail,
  });
  if (result.errorText) console.log('[sync] errors:\n', result.errorText);

  if (withSnapshot) {
    const snap = await writeSnapshot();
    console.log('[snapshot]', snap);
  }
  await prisma.$disconnect();
  process.exit(result.status === 'FAILED' ? 1 : 0);
} catch (err) {
  console.error('[sync] ล้มเหลว:', err.message);
  if (err.reauthorize) console.error('   → ต้อง re-authorize: npm run lark:authorize');
  await prisma.$disconnect();
  process.exit(1);
}
