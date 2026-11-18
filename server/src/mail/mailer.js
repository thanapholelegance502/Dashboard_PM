// SMTP (nodemailer) — ค่าทั้งหมดจาก .env.production · ห้าม log รหัส
import nodemailer from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env.js';

let transport = null;

function getTransport() {
  if (!isSmtpConfigured()) {
    const e = new Error('ยังไม่ได้ตั้งค่า SMTP (SMTP_HOST / SMTP_USER / SMTP_PASS / MAIL_FROM)');
    e.status = 503;
    throw e;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure, // 465 = true · 587 = false (+STARTTLS)
      requireTLS: !env.smtpSecure,
      auth: { user: env.smtpUser, pass: env.smtpPass },
      connectionTimeout: 20_000,
      greetingTimeout: 20_000,
      socketTimeout: 60_000,
    });
  }
  return transport;
}

/** เช็คว่า login SMTP ได้ (ไม่ส่งอะไรจริง) */
export async function verifySmtp() {
  return getTransport().verify();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ส่ง + retry 2 ครั้ง (เว้น 2 นาที) — รหัสผ่านผิด (535) ไม่ retry */
export async function sendMail({ to, subject, html, text, attachments }, { retries = 2, backoffMs = 120_000 } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await getTransport().sendMail({ from: env.mailFrom, to, subject, html, text, attachments });
    } catch (err) {
      const authFail = err.responseCode === 535 || err.code === 'EAUTH';
      if (authFail || attempt >= retries) throw err;
      attempt += 1;
      await sleep(backoffMs);
    }
  }
}
