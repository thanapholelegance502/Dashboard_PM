// Seed whitelist AppUser (MASTER §7) — ใครเข้าได้เมื่อ AUTH_MODE=lark_sso
// อ่านอีเมลจาก env (APP_ADMINS/APP_PMS/APP_VIEWERS) — ไม่ commit อีเมลจริง (กติกา §5/§7)
// larkOpenId ผูกให้เองตอน login ครั้งแรก (src/api/auth/provider.js LarkSsoAuth.handleCallback)
// รัน:  npm run seed:appusers   (idempotent — upsert ตาม email, รันซ้ำได้)
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// "a@x.com, b@y.com" → ['a@x.com','b@y.com'] (ตัดช่องว่าง/ค่าว่าง)
const parse = (s) =>
  (s ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

const GROUPS = [
  { role: 'ADMIN', emails: parse(process.env.APP_ADMINS) },
  { role: 'PM', emails: parse(process.env.APP_PMS) },
  { role: 'VIEWER', emails: parse(process.env.APP_VIEWERS) },
];

async function main() {
  let n = 0;
  const seen = new Set();
  for (const { role, emails } of GROUPS) {
    for (const email of emails) {
      if (seen.has(email)) {
        console.warn(`[seed:appusers] ข้าม ${email} — ซ้ำหลาย role (ใช้ role แรกที่เจอ)`);
        continue;
      }
      seen.add(email);
      const displayName = email.split('@')[0]; // แก้ชื่อจริงทีหลังในหน้า Admin
      await prisma.appUser.upsert({
        where: { email },
        // update เฉพาะ role/isActive — ไม่ทับ larkOpenId/displayName/boards ที่อาจถูกตั้งไปแล้ว
        update: { role, isActive: true },
        // สร้างใหม่: ADMIN เห็นทุกบอร์ดอยู่แล้ว · คนอื่นเริ่มที่ PM แล้วติ๊กเพิ่มในแท็บผู้ใช้
        create: { email, displayName, role, isActive: true, boards: role === 'ADMIN' ? [] : ['PM'] },
      });
      n += 1;
    }
  }
  if (n === 0) {
    console.warn('[seed:appusers] ไม่มีอีเมลใน APP_ADMINS/APP_PMS/APP_VIEWERS — ยังไม่ได้ whitelist ใคร');
  } else {
    console.log(`[seed:appusers] whitelist ${n} คนเรียบร้อย`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
