const API = 'https://discord.com/api/v10';

/* บอทไม่ใช่บัญชีคุณ อ่าน DM ส่วนตัวไม่ได้ (ต่างจาก Slack ที่ใช้ user token)
   จึงมีแค่ feed() ของห้องที่เพิ่มบอทเข้าไปเท่านั้น ไม่มี dms() */

function token() {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error('ยังไม่ได้ตั้ง DISCORD_BOT_TOKEN ใน .env');
  return t;
}

function channelIds() {
  return String(process.env.DISCORD_CHANNEL_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

async function api(path) {
  const res = await fetch(API + path, { headers: { Authorization: `Bot ${token()}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`discord ${path} → ${res.status} ${body.message || res.statusText}`);
  }
  return res.json();
}

/* ---------- ชื่อห้อง (cache กันยิงถี่) ---------- */

let chanCache = new Map();
let chanAt = 0;

async function channelName(id) {
  if (Date.now() - chanAt > 10 * 60_000) { chanCache = new Map(); chanAt = Date.now(); }
  if (chanCache.has(id)) return chanCache.get(id);
  const name = await api(`/channels/${id}`).then(c => c.name || id).catch(() => id);
  chanCache.set(id, name);
  return name;
}

/* ---------- ทำความสะอาดข้อความ ---------- */

/* Discord ใส่ mention ดิบมาเป็น <@id> <@&roleId> <#chanId> <a?:emoji:id>
   ต้องแทนด้วยชื่อคน ไม่งั้นข้อความจะเต็มไปด้วยตัวเลข id */
export function clean(text, mentions = []) {
  const names = Object.fromEntries((mentions || []).map(u => [u.id, u.global_name || u.username]));
  return String(text || '')
    .replace(/<a?:(\w+):\d+>/g, ':$1:')
    .replace(/<@!?(\d+)>/g, (_, id) => '@' + (names[id] || id))
    .replace(/<@&\d+>/g, '@role')
    .replace(/<#\d+>/g, '#channel')
    .replace(/\s+/g, ' ')
    .trim();
}

async function history(id, limit = 50) {
  try {
    return await api(`/channels/${id}/messages?limit=${limit}`);
  } catch {
    return [];   // บอทไม่ได้อยู่ในห้องนั้น หรือไม่มีสิทธิ์ — ข้ามไป ไม่ให้ทั้งหน้าพัง
  }
}

/* type 0 = ข้อความปกติ, 19 = ตอบกลับ (reply) — ที่เหลือเป็น event ของระบบ เช่นคนเข้าห้อง */
const isChat = m => m.type === 0 || m.type === 19;

/* ---------- public ---------- */

/** ความเคลื่อนไหวในห้องที่ตั้งไว้ใน DISCORD_CHANNEL_IDS */
export async function feed({ days = 7, limit = 40 } = {}) {
  const ids = channelIds();
  if (!ids.length) throw new Error('ยังไม่ได้ตั้ง DISCORD_CHANNEL_IDS ใน .env');

  const oldest = Date.now() - days * 864e5;
  const rows = [];

  for (const id of ids) {
    const [name, msgs] = await Promise.all([channelName(id), history(id)]);
    msgs
      .filter(m => isChat(m) && m.content && new Date(m.timestamp).getTime() >= oldest)
      .forEach(m => rows.push({
        chan: name,
        isDm: false,
        author: m.author?.global_name || m.author?.username || 'ไม่ทราบ',
        text: clean(m.content, m.mentions),
        ts: m.timestamp
      }));
  }

  return rows.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, limit);
}
