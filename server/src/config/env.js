import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const env = {
  // Lark
  larkAppId: process.env.LARK_APP_ID ?? 'cli_aa20a1d6d338def1',
  larkAppSecret: process.env.LARK_APP_SECRET ?? '',
  // Host สิงคโปร์ — ห้ามเขียน URL เต็มกระจายที่อื่น (DATA-LAYER §1 กับดัก 1)
  larkApiHost: process.env.LARK_API_HOST ?? 'https://open-sg.larksuite.com/open-apis',
  // หน้า authorize UI (browser login) อยู่คนละ host กับ API gateway — accounts.larksuite.com
  larkAuthorizeBase: process.env.LARK_AUTHORIZE_BASE ?? 'https://accounts.larksuite.com/open-apis',
  // OAuth token endpoint เป็น global บน open.larksuite.com (open-sg คืน 502 — ไม่ serve auth)
  larkTokenBase: process.env.LARK_TOKEN_BASE ?? 'https://open.larksuite.com/open-apis',
  larkRedirectUri: process.env.LARK_REDIRECT_URI ?? 'http://localhost:3000/api/auth/callback',

  // DB
  databaseUrl: process.env.DATABASE_URL ?? '',

  // App
  port: Number(process.env.PORT ?? 3000),
  tz: process.env.TZ ?? 'Asia/Bangkok',
  authMode: process.env.AUTH_MODE ?? 'dev', // dev | lark_sso
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-secret',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // cookie secure=true เมื่อ production (อยู่หลัง https/nginx) — override ด้วย COOKIE_SECURE
  cookieSecure: (process.env.COOKIE_SECURE ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',
  trustProxy: (process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true',

  // Sync schedule
  cronMorning: process.env.SYNC_CRON_MORNING ?? '0 8 * * *',
  cronEvening: process.env.SYNC_CRON_EVENING ?? '0 17 * * *',
};

export function assertLarkConfig() {
  required('LARK_APP_ID');
  required('LARK_APP_SECRET');
}
