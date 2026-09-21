// CLI: npm run lark:authorize — setup token (DATA-LAYER §2)
// 2 mode:
//   ไม่มี arg           → print URL (เปิด browser, login, ก็อบ code จาก address bar)
//   -- --code <code>    → แลก code → เขียน token ลง DB (ข้าม callback/firewall)
// mode paste code ใช้ตอน server อยู่หลัง firewall (เปิด port ไม่ได้)
import { env, assertLarkConfig } from '../src/config/env.js';
import { buildAuthorizeUrl, exchangeCodeForToken, REQUIRED_SCOPES } from '../src/lark/auth.js';
import { prisma } from '../src/db/prisma.js';

assertLarkConfig();

// รับ code จาก arg: --code=XXX หรือ --code XXX
const args = process.argv.slice(2);
let code = null;
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--code=')) code = args[i].slice(7);
  else if (args[i] === '--code') code = args[i + 1];
}

if (code) {
  // ── mode: แลก code ──
  try {
    const tok = await exchangeCodeForToken(code.trim());
    console.log('✅ ได้ token แล้ว — เขียนลง DB (OAuthToken)');
    console.log('   expiresAt:', tok.expiresAt.toISOString());
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ แลก code ล้มเหลว:', err.message);
    console.error('   code หมดอายุเร็ว (~นาที) + ใช้ครั้งเดียว — ทำ URL ใหม่แล้วก็อบ code ให้ไว');
    await prisma.$disconnect();
    process.exit(1);
  }
} else {
  // ── mode: print URL ──
  const state = `setup-${Date.now()}`;
  console.log('\n=== Lark Authorize (ในนามข้าว) ===');
  console.log('Scope:', REQUIRED_SCOPES.join(', '));
  console.log('\n1) เปิด URL นี้ใน browser (เครื่องที่ login Lark ได้) → login + กดอนุญาต:\n');
  console.log(buildAuthorizeUrl(state));
  console.log(`\n2) หลังกดอนุญาต browser จะเด้งไป ${env.larkRedirectUri}?code=... (หน้าจะ error ไม่เป็นไร)`);
  console.log('   → ก็อบค่า code จาก address bar (ส่วนหลัง code= จนถึง & หรือจบ URL)\n');
  console.log('3) เอา code มารันบน server (ก็อบ code ให้ไว หมดอายุใน ~นาที):');
  console.log('   docker compose -f docker-compose.prod.yml exec server npm run lark:authorize -- --code <CODE>\n');
  await prisma.$disconnect();
  process.exit(0);
}
