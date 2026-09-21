// CLI: npm run lark:authorize — setup ครั้งแรก / กู้คืน token (DATA-LAYER §2)
// เปิด URL ให้ข้าว login+อนุญาต แล้วดัก callback ที่ localhost:3000 → เขียน token ลง DB
import http from 'node:http';
import { URL } from 'node:url';
import { env, assertLarkConfig } from '../src/config/env.js';
import { buildAuthorizeUrl, exchangeCodeForToken, REQUIRED_SCOPES } from '../src/lark/auth.js';
import { prisma } from '../src/db/prisma.js';

assertLarkConfig();

const redirect = new URL(env.larkRedirectUri);
const port = Number(redirect.port || 3000);
const state = `setup-${Date.now()}`;
const authUrl = buildAuthorizeUrl(state);

console.log('\n=== Lark Authorize (ในนามข้าว) ===');
console.log('Scope ที่ขอ:', REQUIRED_SCOPES.join(', '));
console.log('\n1) เปิด URL นี้ใน browser แล้ว login + กดอนุญาต:\n');
console.log(authUrl);
console.log(`\n2) รอ callback ที่ ${env.larkRedirectUri} ...\n`);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${port}`);
  if (u.pathname !== redirect.pathname) {
    res.writeHead(404).end('not found');
    return;
  }
  const code = u.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('missing code');
    return;
  }
  try {
    const tok = await exchangeCodeForToken(code);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2>สำเร็จ ✅ ปิดหน้านี้ได้เลย</h2>');
    console.log('✅ ได้ token แล้ว — เขียนลง DB (OAuthToken)');
    console.log('   expiresAt:', tok.expiresAt.toISOString());
    await prisma.$disconnect();
    server.close(() => process.exit(0));
  } catch (err) {
    res.writeHead(500).end('error: ' + err.message);
    console.error('❌ แลก token ล้มเหลว:', err.message);
    await prisma.$disconnect();
    server.close(() => process.exit(1));
  }
});

server.listen(port, () => console.log(`   (temp server ฟังที่ :${port})`));
