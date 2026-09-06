import crypto from 'node:crypto';
import { google } from 'googleapis';

/* ระบบ login หน้าเว็บ — แยกจาก OAuth ที่ใช้ดึงข้อมูล Gmail/ปฏิทินใน google.js โดยสิ้นเชิง
   อันนี้แค่เช็คว่า "ใครกำลังเปิดหน้านี้อยู่" ไม่ได้ขอสิทธิ์อ่านอะไรจากบัญชีที่ login เข้ามาเลย
   (scope แค่ openid/email/profile ไม่แตะ Gmail/Calendar)

   เปิดใช้งานเมื่อตั้งทั้ง ALLOWED_EMAIL และ SESSION_SECRET ใน .env เท่านั้น — ถ้าไม่ตั้งสองตัวนี้
   แอปจะเปิดให้เข้าได้เหมือนเดิมทุกประการ (โหมด local คนเดียวใช้) ตั้งไว้ตอนจะ deploy ให้คนอื่นเข้าถึง URL ได้ */

const COOKIE_NAME = 'md_session';
const SESSION_MS = 30 * 24 * 3600_000;   // 30 วัน
const SCOPES = ['openid', 'email', 'profile'];

export function loginEnabled() {
  return Boolean(process.env.ALLOWED_EMAIL && process.env.SESSION_SECRET);
}

function allowedEmail() {
  return String(process.env.ALLOWED_EMAIL || '').toLowerCase().trim();
}

function siteOauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SITE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('ยังไม่ได้ตั้ง GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ใน .env');
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    SITE_REDIRECT_URI || 'http://localhost:3000/auth/site/callback'
  );
}

export function siteLoginUrl(state) {
  return siteOauthClient().generateAuthUrl({ scope: SCOPES, state, prompt: 'select_account' });
}

/** แลก code เป็นอีเมลของคนที่เพิ่ง login — ไม่เก็บ token นี้ไว้ที่ไหนเลย ใช้ครั้งเดียวทิ้ง */
export async function emailFromCode(code) {
  const client = siteOauthClient();
  const { tokens } = await client.getToken(code);
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  if (!res.ok) throw new Error('อ่านข้อมูลบัญชี Google ไม่สำเร็จ');
  const info = await res.json();
  return { email: String(info.email || '').toLowerCase().trim(), name: info.name };
}

/* ---------- คุกกี้ session เซ็นชื่อด้วย HMAC กันปลอม ไม่ใช้ library แยก ---------- */

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('ยังไม่ได้ตั้ง SESSION_SECRET ใน .env');
  return s;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(value) {
  if (!value) return null;
  const i = value.lastIndexOf('.');
  if (i < 0) return null;
  const body = value.slice(0, i), sig = value.slice(i + 1);
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

export function sessionCookie(email) {
  const value = sign({ email, exp: Date.now() + SESSION_MS });
  const secureFlag = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${COOKIE_NAME}=${value}; HttpOnly;${secureFlag} SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_MS / 1000)}`;
}

export function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`;
}

export function sessionOf(req) {
  return verify(parseCookies(req.headers.cookie)[COOKIE_NAME]);
}

/** middleware กันหน้า — ปิดอยู่โดย default ถ้ายังไม่ได้ตั้ง ALLOWED_EMAIL/SESSION_SECRET */
export function requireAuth(req, res, next) {
  if (!loginEnabled()) return next();
  const session = sessionOf(req);
  if (session && session.email === allowedEmail()) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'ยังไม่ได้ login' });
  res.redirect('/login');
}
