// Google service account → access token (บอร์ด YOK)
// แยกจาก client.js แบบเดียวกับที่ lark/auth.js แยกจาก lark/client.js
// ‼️ key ห้าม log ห้ามใส่ error message ห้ามคืนออก route ใด ๆ
import { readFileSync } from 'node:fs';
import { JWT } from 'google-auth-library';
import { env } from '../config/env.js';

// อ่านอย่างเดียว — key รั่วก็เขียน/ลบชีตไม่ได้
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

let client = null;

function loadKey() {
  // ไฟล์ mount มาก่อน (ทางหลัก) · B64 สำรอง · ไม่รองรับ ADC โดยตั้งใจ
  let raw;
  if (env.googleSaKeyFile) {
    raw = readFileSync(env.googleSaKeyFile, 'utf8');
  } else if (env.googleSaKeyB64) {
    raw = Buffer.from(env.googleSaKeyB64, 'base64').toString('utf8');
  } else {
    throw new Error('ไม่พบ service account key (GOOGLE_SA_KEY_FILE หรือ GOOGLE_SA_KEY_B64)');
  }
  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    // ห้าม echo raw — มี private key อยู่ข้างใน
    throw new Error('service account key ไม่ใช่ JSON ที่อ่านได้');
  }
  if (!key.client_email || !key.private_key) {
    throw new Error('service account key ขาด client_email หรือ private_key');
  }
  return key;
}

function getClient() {
  if (client) return client;
  const key = loadKey();
  client = new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
  return client;
}

/** access token (google-auth-library cache + refresh ให้เอง) */
export async function getSheetsToken() {
  const { token } = await getClient().getAccessToken();
  if (!token) throw new Error('ขอ access token จาก Google ไม่สำเร็จ');
  return token;
}

/** ทิ้ง token ที่ cache ไว้ — ใช้ตอนเจอ 401/invalid_grant แล้วจะ retry */
export function dropSheetsToken() {
  if (client) client.credentials = {};
}

/** อีเมลของ service account (เอาไว้บอกข้าวว่าต้องแชร์ชีตให้ใคร) — ไม่ใช่ความลับ */
export function serviceAccountEmail() {
  try {
    return loadKey().client_email;
  } catch {
    return null;
  }
}

/** test เท่านั้น */
export function _resetSheetsAuth() {
  client = null;
}
