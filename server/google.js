import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_PATH = path.join(ROOT, 'token.json');

// อ่านอย่างเดียวพอ — dashboard ไม่แก้อะไรในกล่องจดหมาย
export const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

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
  return tokens;
}

let cached = null;

/** คืน OAuth client ที่พร้อมใช้ หรือ null ถ้ายังไม่ได้ authorize */
export async function authedClient() {
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

  cached = client;
  return client;
}

export async function gmailClient() {
  const auth = await authedClient();
  if (!auth) return null;
  return google.gmail({ version: 'v1', auth });
}

export function forgetToken() {
  cached = null;
  return fs.unlink(TOKEN_PATH).catch(() => {});
}
