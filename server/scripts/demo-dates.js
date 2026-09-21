// ⚠️ DEMO เท่านั้น — ใส่ target/forecast date ตัวอย่างให้ Gantt/milestone มีของโชว์
// ข้าวลบ/แก้ผ่านหน้า Admin ได้ · ไม่ใช่ข้อมูลจริง
import { prisma } from '../src/db/prisma.js';

const now = new Date();
const d = (days) => new Date(now.getTime() + days * 86400000);

// ตั้งให้เห็นครบสถานะ: at-risk (blocker/overdue จริง) + delayed (forecast>target)
const demo = {
  AUS_SILVER: { startDate: d(-40), targetUat: d(20), targetGolive: d(50), forecastGolive: d(50) },
  MYGOLD_BSEA: { startDate: d(-60), targetUat: d(5), targetGolive: d(12), forecastGolive: d(12) },
  LKN: { startDate: d(-70), targetUat: d(-5), targetGolive: d(10), forecastGolive: d(24) }, // forecast>target → DELAYED
};

for (const [code, data] of Object.entries(demo)) {
  await prisma.project.update({ where: { projectCode: code }, data });
  console.log(`[demo] ${code} ตั้ง date แล้ว`);
}
await prisma.$disconnect();
console.log('เสร็จ — ข้าวลบ/แก้ผ่านหน้า Admin ได้');
