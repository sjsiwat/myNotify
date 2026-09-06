import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_PATH = path.join(ROOT, 'token.json');

// ขอ modify เพราะแดชบอร์ดกดอ่านแล้ว/ลบอีเมลได้ (ลบ = ย้ายเข้าถังขยะ ยังกู้คืนได้ ไม่ใช่ลบถาวร)
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';

// ปฏิทินต้องเขียนได้ (เพิ่ม/แก้/ลบนัด) แต่ขอเท่าที่ใช้ — events เขียนได้เฉพาะตัวนัด
// ส่วน calendar.readonly ใช้แค่ดึงรายชื่อปฏิทินกับสีของแต่ละอัน
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export const SCOPES = [GMAIL_SCOPE, CALENDAR_SCOPE, CALENDAR_LIST_SCOPE];

export function oauthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('ยังไม่ได้ตั้ง GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ใน .env');
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
  );
}

export function consentUrl(state) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',   // ขอ refresh_token
    prompt: 'consent',        // บังคับให้ออก refresh_token ใหม่ทุกครั้ง
    scope: SCOPES,
    state                     // กัน CSRF — ตรวจตอน callback
  });
}

/** เขียน token.json แบบเจ้าของอ่านได้คนเดียว (0600) — ข้างในมี refresh_token */
async function writeToken(tokens) {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), { encoding: 'utf8', mode: 0o600 });
  // mode ใน writeFile มีผลตอนสร้างไฟล์ใหม่เท่านั้น ไฟล์เดิมต้อง chmod ซ้ำ
  await fs.chmod(TOKEN_PATH, 0o600).catch(() => {});
}

export async function saveTokenFromCode(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await writeToken(tokens);
  // ทิ้งของเก่าทิ้ง ไม่งั้นยัง cache token ชุดก่อนไว้ — สำคัญตอน authorize ซ้ำเพื่อขอ scope เพิ่ม
  cached = null;
  return tokens;
}

let cached = null;   // { client, scopes:Set }

/** อ่าน token.json แล้วประกอบ client — คืน null ถ้ายังไม่ได้ authorize */
async function load() {
  if (cached) return cached;
  let tokens;
  try {
    tokens = JSON.parse(await fs.readFile(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
  const client = oauthClient();
  client.setCredentials(tokens);

  // googleapis รีเฟรช access_token ให้เอง — เราแค่เขียนทับไฟล์เมื่อได้ token ใหม่
  client.on('tokens', async t => {
    try { await writeToken({ ...tokens, ...t }); } catch {}
  });

  cached = { client, scopes: new Set(String(tokens.scope || '').split(' ').filter(Boolean)) };
  return cached;
}

/** คืน OAuth client ที่พร้อมใช้ หรือ null ถ้ายังไม่ได้ authorize */
export async function authedClient() {
  return (await load())?.client ?? null;
}

/** token ที่มีอยู่ได้สิทธิ์นี้มาหรือยัง — token เก่าที่ออกก่อนเพิ่ม scope จะยังไม่มี */
export async function hasScope(scope) {
  return Boolean((await load())?.scopes.has(scope));
}

export async function gmailClient() {
  const auth = await authedClient();
  if (!auth) return null;
  return google.gmail({ version: 'v1', auth });
}

export async function calendarClient() {
  const auth = await authedClient();
  if (!auth || !(await hasScope(CALENDAR_SCOPE))) return null;
  return google.calendar({ version: 'v3', auth });
}

export function forgetToken() {
  cached = null;
  return fs.unlink(TOKEN_PATH).catch(() => {});
}
