import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { consentUrl, saveTokenFromCode, authedClient, forgetToken } from './google.js';
import * as gmail from './gmail.js';
import * as slack from './slack.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;

// ผูกกับ loopback อย่างเดียว — แดชบอร์ดไม่มีระบบ login ใครเปิดได้ก็อ่านอีเมลได้
// ตั้ง HOST=0.0.0.0 เองได้ถ้ารู้ว่ากำลังทำอะไรอยู่
const HOST = process.env.HOST || '127.0.0.1';

// กัน token/secret หลุดออกไปกับข้อความ error ที่ส่งให้ browser
const SECRET_RE =
  /xox[pbaors]-[\w-]+|GOCSPX-[\w-]+|ya29\.[\w.-]+|[\w-]{20,}\.apps\.googleusercontent\.com|1\/\/[\w-]{20,}/gi;
const safe = msg => String(msg || 'เกิดข้อผิดพลาด').replace(SECRET_RE, '[ซ่อนไว้]');

const app = express();
app.use(express.static(path.join(ROOT, 'public')));

/* ---------- cache ชั้นบาง ๆ กันยิง API ถี่เกิน ---------- */

const TTL = 60_000;
const store = new Map();

async function cached(key, fn) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.val;
  const val = await fn();
  store.set(key, { at: Date.now(), val });
  return val;
}

/** ห่อ route ให้ error กลายเป็น JSON แทนที่จะพัง process */
const route = fn => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (e) {
    console.error(`[${req.path}]`, e.message);   // ตัวเต็มอยู่ใน log ฝั่ง server
    res.status(500).json({ error: safe(e.message) });
  }
};

/* ---------- auth ---------- */

/** state กัน CSRF — ผู้ใช้คนเดียวเครื่องเดียว เก็บในหน่วยความจำพอ */
let pendingState = null;

app.get('/auth/google', (req, res) => {
  try {
    pendingState = crypto.randomBytes(16).toString('hex');
    res.redirect(consentUrl(pendingState));
  } catch (e) {
    res.status(500).send(safe(e.message));
  }
});

app.get('/auth/google/callback', async (req, res) => {
  if (req.query.error) return res.status(400).send(`ปฏิเสธสิทธิ์: ${safe(req.query.error)}`);
  if (!req.query.code) return res.status(400).send('ไม่มี code กลับมา');

  // ต้องมาจากคำขอที่เราเป็นคนเริ่มเท่านั้น กันคนอื่นยัด token ของเขาเข้าเครื่องเรา
  if (!pendingState || req.query.state !== pendingState) {
    return res.status(400).send('<meta charset="utf-8">state ไม่ตรง — เริ่มใหม่ที่ <a href="/auth/google">/auth/google</a>');
  }
  pendingState = null;

  try {
    await saveTokenFromCode(String(req.query.code));
    store.clear();
    res.send('<meta charset="utf-8">เชื่อม Gmail สำเร็จ — <a href="/">กลับไปหน้า dashboard</a>');
  } catch (e) {
    console.error('[/auth/google/callback]', e.message);
    res.status(500).send('แลก token ไม่สำเร็จ: ' + safe(e.message));
  }
});

app.post('/auth/google/logout', route(async () => {
  await forgetToken();
  store.clear();
  return { ok: true };
}));

app.get('/api/status', route(async () => ({
  gmail: Boolean(await authedClient()),
  slack: Boolean(process.env.SLACK_USER_TOKEN)
})));

/* ---------- gmail ---------- */

const needAuth = { error: 'ยังไม่ได้เชื่อม Gmail', authUrl: '/auth/google' };

app.get('/api/mail/summary', route(async () =>
  (await cached('summary', gmail.summary)) ?? needAuth));

app.get('/api/mail/inbox', route(async () =>
  (await cached('inbox', () => gmail.inbox())) ?? needAuth));

app.get('/api/spend', route(async () =>
  (await cached('spend', () => gmail.spend())) ?? needAuth));

/* ---------- slack ---------- */

app.get('/api/slack', route(async () => cached('slack', async () => {
  const [d, f] = await Promise.all([slack.dms(), slack.feed()]);
  return { dms: d, feed: f };
})));

/* ---------- go ---------- */

app.listen(PORT, HOST, () => {
  console.log(`\n  myDashboard  →  http://localhost:${PORT}\n`);
  if (!process.env.GOOGLE_CLIENT_ID) console.log('  ⚠ ยังไม่ได้ตั้ง GOOGLE_CLIENT_ID ใน .env');
  if (!process.env.SLACK_USER_TOKEN) console.log('  ⚠ ยังไม่ได้ตั้ง SLACK_USER_TOKEN ใน .env');
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log(`  ⚠ กำลัง listen ที่ ${HOST} — แดชบอร์ดไม่มีระบบ login`);
    console.log('    ใครที่เข้าถึงเครื่องนี้ทางเน็ตเวิร์กได้ จะอ่านอีเมลและ Slack ของคุณได้ทันที');
  }
  console.log('');
});
