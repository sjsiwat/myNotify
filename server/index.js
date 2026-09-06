import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { consentUrl, saveTokenFromCode, authedClient, forgetToken, hasScope, CALENDAR_SCOPE, GMAIL_SCOPE } from './google.js';
import { loginEnabled, siteLoginUrl, emailFromCode, sessionCookie, clearCookie, requireAuth } from './auth.js';
import * as gmail from './gmail.js';
import * as slack from './slack.js';
import * as github from './github.js';
import * as calendar from './calendar.js';
import * as discord from './discord.js';
import * as line from './line.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 3000;

// ผูกกับ loopback อย่างเดียว — แดชบอร์ดไม่มีระบบ login ใครเปิดได้ก็อ่านอีเมลได้
// ตั้ง HOST=0.0.0.0 เองได้ถ้ารู้ว่ากำลังทำอะไรอยู่
const HOST = process.env.HOST || '127.0.0.1';

// กัน token/secret หลุดออกไปกับข้อความ error ที่ส่งให้ browser
const SECRET_RE =
  /xox[pbaors]-[\w-]+|GOCSPX-[\w-]+|ya29\.[\w.-]+|[\w-]{20,}\.apps\.googleusercontent\.com|1\/\/[\w-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[\w]{20,}|[MN][\w-]{23,25}\.[\w-]{6}\.[\w-]{27,}/gi;
const safe = msg => String(msg || 'เกิดข้อผิดพลาด').replace(SECRET_RE, '[ซ่อนไว้]');

const app = express();
app.set('trust proxy', true); // อยู่หลัง Render/Cloudflare — ต้องอ่าน X-Forwarded-* ให้ req.protocol/req.secure ถูก

/* หน้า login กับ endpoint OAuth ของมันต้องเข้าได้ก่อน login เสมอ ไม่งั้นเข้าไป login ไม่ได้เลย
   ที่เหลือทั้งหมด (รวมไฟล์ static และ /auth/google ของ Gmail) โดน requireAuth คุม
   ถ้ายังไม่ได้ตั้ง ALLOWED_EMAIL/SESSION_SECRET ใน .env ฟังก์ชันนี้ผ่านให้หมดเหมือนเดิม (โหมด local) */
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/login.html' || req.path.startsWith('/auth/site/')) return next();
  requireAuth(req, res, next);
});

app.use(express.static(path.join(ROOT, 'web', 'dist')));
app.use(express.json({ limit: '64kb' }));

/* กันเว็บอื่นที่ผู้ใช้เปิดอยู่ยิงคำสั่งมาแทนเจ้าตัว — เทียบว่า origin ตรงกับ host ที่เสิร์ฟจริงไหม
   (คำขอ JSON ข้ามโดเมนโดน preflight อยู่แล้ว อันนี้เป็นชั้นที่สอง ใช้ได้ทั้ง localhost และโดเมนที่ deploy จริง) */
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.get('origin');
  if (origin) {
    let originHost;
    try { originHost = new URL(origin).host; } catch { originHost = null; }
    if (originHost !== req.get('host')) {
      return res.status(403).json({ error: 'ปฏิเสธคำขอที่มาจากโดเมนอื่น' });
    }
  }
  next();
});

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

/* ---------- login หน้าเว็บ (แยกจาก OAuth อ่านข้อมูล Gmail ด้านล่าง) ---------- */

app.get('/login', (req, res) => res.sendFile(path.join(ROOT, 'public', 'login.html')));

let pendingSiteState = null;

app.get('/auth/site/login', (req, res) => {
  if (!loginEnabled()) return res.redirect('/');
  try {
    pendingSiteState = crypto.randomBytes(16).toString('hex');
    res.redirect(siteLoginUrl(pendingSiteState));
  } catch (e) {
    res.status(500).send(safe(e.message));
  }
});

app.get('/auth/site/callback', async (req, res) => {
  if (req.query.error) return res.status(400).send(`ปฏิเสธสิทธิ์: ${safe(req.query.error)}`);
  if (!req.query.code) return res.status(400).send('ไม่มี code กลับมา');
  if (!pendingSiteState || req.query.state !== pendingSiteState) {
    return res.status(400).send('<meta charset="utf-8">state ไม่ตรง — เริ่มใหม่ที่ <a href="/login">/login</a>');
  }
  pendingSiteState = null;

  try {
    const { email } = await emailFromCode(String(req.query.code));
    if (email !== String(process.env.ALLOWED_EMAIL || '').toLowerCase().trim()) {
      return res.status(403).send(
        '<meta charset="utf-8"><body style="font-family:sans-serif;padding:60px;text-align:center">' +
        '<h2>ไม่มีสิทธิ์เข้าถึง</h2><p>บัญชีนี้ไม่ได้รับอนุญาตให้เข้าแดชบอร์ดนี้</p>' +
        '<p><a href="/login">กลับไปหน้า login</a></p></body>'
      );
    }
    res.setHeader('Set-Cookie', sessionCookie(email));
    res.redirect('/');
  } catch (e) {
    console.error('[/auth/site/callback]', e.message);
    res.status(500).send('เข้าสู่ระบบไม่สำเร็จ: ' + safe(e.message));
  }
});

app.post('/auth/site/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearCookie());
  res.json({ ok: true });
});

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
    calendar.forgetCalendarList();
    res.send('<meta charset="utf-8">เชื่อม Gmail + ปฏิทิน สำเร็จ — <a href="/">กลับไปหน้า dashboard</a>');
  } catch (e) {
    console.error('[/auth/google/callback]', e.message);
    res.status(500).send('แลก token ไม่สำเร็จ: ' + safe(e.message));
  }
});

app.post('/auth/google/logout', route(async () => {
  await forgetToken();
  store.clear();
  calendar.forgetCalendarList();
  return { ok: true };
}));

app.get('/api/status', route(async () => ({
  gmail: Boolean(await authedClient()),
  // token เก่าที่ออกก่อนขยายเป็น gmail.modify จะ gmail=true แต่ gmailWrite=false — ปุ่มอ่านแล้ว/ลบต้องกันไว้ตามนี้
  gmailWrite: await hasScope(GMAIL_SCOPE),
  // token ที่ออกก่อนเพิ่ม scope ปฏิทินจะ gmail=true แต่ calendar=false — ต้องกดเชื่อมใหม่
  calendar: await hasScope(CALENDAR_SCOPE),
  slack: Boolean(process.env.SLACK_USER_TOKEN || process.env.SLACK_USER_TOKENS),
  github: Boolean(process.env.GITHUB_TOKEN),
  discord: Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_IDS),
  line: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID),
  loginEnabled: loginEnabled()
})));

/* ---------- gmail ---------- */

const needAuth = { error: 'ยังไม่ได้เชื่อม Gmail', authUrl: '/auth/google' };

app.get('/api/mail/summary', route(async () =>
  (await cached('summary', gmail.summary)) ?? needAuth));

app.get('/api/mail/inbox', route(async () =>
  (await cached('inbox', () => gmail.inbox())) ?? needAuth));

app.get('/api/mail/message/:id', route(async req =>
  (await gmail.read(req.params.id)) ?? needAuth));

/** ทำอีเมลแล้วต้องทิ้ง cache inbox/summary เดิม ไม่งั้นหน้าเว็บจะยังโชว์เลขค้างเก่า */
const dropMail = () => { store.delete('inbox'); store.delete('summary'); };

app.post('/api/mail/read', route(async req => {
  const r = await gmail.markRead(req.body?.ids);
  if (!r) return needAuth;
  dropMail();
  return r;
}));

app.post('/api/mail/trash', route(async req => {
  const r = await gmail.trash(req.body?.ids);
  if (!r) return needAuth;
  dropMail();
  return r;
}));

/* ---------- calendar ---------- */

const needCal = { error: 'ยังไม่ได้ให้สิทธิ์ปฏิทิน', authUrl: '/auth/google' };

/** ทิ้งเฉพาะ cache ของปฏิทิน — ของ Gmail/Slack ไม่เกี่ยว ไม่ต้องโดนด้วย */
const dropCal = () => {
  for (const k of store.keys()) if (k.startsWith('cal:')) store.delete(k);
};

const monthOf = q => (/^\d{4}-\d{2}$/.test(String(q || '')) ? String(q) : new Date().toISOString().slice(0, 7));

app.get('/api/calendar', route(async req => {
  const m = monthOf(req.query.month);
  return (await cached('cal:' + m, () => calendar.month(m))) ?? needCal;
}));

/* เขียนไม่ผ่าน cache และล้างของเดิมทิ้งทุกครั้ง ไม่งั้นหน้าเว็บจะโหลดภาพเก่ากลับมา */
app.post('/api/calendar', route(async req => {
  const r = await calendar.create(req.body || {});
  if (!r) return needCal;
  dropCal();
  return r;
}));

app.patch('/api/calendar', route(async req => {
  const r = await calendar.update(req.body || {});
  if (!r) return needCal;
  dropCal();
  return r;
}));

app.delete('/api/calendar', route(async req => {
  const r = await calendar.remove(req.body || {});
  if (!r) return needCal;
  dropCal();
  return r;
}));

/* ---------- slack ---------- */

app.get('/api/slack', route(async () => cached('slack', async () => {
  const [d, f] = await Promise.all([slack.dms(), slack.feed()]);
  return { dms: d, feed: f };
})));

/* ---------- github ---------- */

app.get('/api/github', route(async () => cached('github', () => github.overview())));

/* ---------- discord ---------- */

app.get('/api/discord', route(async () => cached('discord', () => discord.feed())));

/* ---------- line digest ---------- */

/** รวมข้อมูลที่มีอยู่แล้ว (อีเมล/นัดวันนี้/Slack) เป็นข้อความสั้น ๆ ส่งเข้า LINE ของตัวเอง */
app.post('/api/line/digest', route(async () => {
  const monthKey = new Date().toISOString().slice(0, 7);
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });   // YYYY-MM-DD ตามเวลาไทย

  const [summary, cal, dms] = await Promise.all([
    gmail.summary().catch(() => null),
    calendar.month(monthKey).catch(() => null),
    slack.dms().catch(() => [])
  ]);

  const todayEvents = (cal?.events || []).filter(e =>
    e.allDay ? (e.start <= todayStr && e.end >= todayStr) : e.start.slice(0, 10) === todayStr);

  const lines = [
    `สรุปวันนี้ (${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long' })})`, ''
  ];

  lines.push(summary ? `Inbox ค้าง ${summary.inbox} ฉบับ · ยังไม่อ่าน ${summary.unread}` : 'Inbox: ยังไม่ได้เชื่อม Gmail');
  lines.push('');

  if (todayEvents.length) {
    lines.push('นัดวันนี้:');
    todayEvents.forEach(e => {
      const time = e.allDay ? 'ทั้งวัน'
        : new Date(e.start).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
      lines.push(`  ${time} ${e.title}`);
    });
  } else {
    lines.push('วันนี้ไม่มีนัด');
  }
  lines.push('');

  if (dms.length) {
    const people = [...new Set(dms.map(d => d.author))];
    lines.push(`Slack ทักมา ${dms.length} ข้อความ จาก ${people.length} คน:`);
    people.slice(0, 5).forEach(a => lines.push(`  · ${a}`));
  } else {
    lines.push('Slack: ไม่มีข้อความถึงคุณ');
  }

  return line.push(lines.join('\n'));
}));

/* ---------- go ---------- */

app.listen(PORT, HOST, () => {
  console.log(`\n  myDashboard  →  http://localhost:${PORT}\n`);
  if (!process.env.GOOGLE_CLIENT_ID) console.log('  ⚠ ยังไม่ได้ตั้ง GOOGLE_CLIENT_ID ใน .env');
  if (!process.env.SLACK_USER_TOKEN && !process.env.SLACK_USER_TOKENS) console.log('  ⚠ ยังไม่ได้ตั้ง SLACK_USER_TOKEN ใน .env');
  if (!process.env.GITHUB_TOKEN) console.log('  ⚠ ยังไม่ได้ตั้ง GITHUB_TOKEN ใน .env');
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    console.log(`  ⚠ กำลัง listen ที่ ${HOST} — แดชบอร์ดไม่มีระบบ login`);
    console.log('    ใครที่เข้าถึงเครื่องนี้ทางเน็ตเวิร์กได้ จะอ่านอีเมลและ Slack ของคุณได้ทันที');
  }
  console.log('');
});
