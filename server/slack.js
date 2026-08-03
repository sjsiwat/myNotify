const API = 'https://slack.com/api/';

function token() {
  const t = process.env.SLACK_USER_TOKEN;
  if (!t) throw new Error('ยังไม่ได้ตั้ง SLACK_USER_TOKEN ใน .env');
  return t;
}

async function slack(method, params = {}) {
  const url = new URL(API + method);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
  const json = await res.json();
  if (!json.ok) {
    // missing_scope บอกตรง ๆ ว่าต้องเพิ่ม scope ไหน
    throw new Error(`slack ${method}: ${json.error}${json.needed ? ` (ต้องการ scope: ${json.needed})` : ''}`);
  }
  return json;
}

/* ---------- users cache ---------- */

let userCache = null;
let userCacheAt = 0;

async function users() {
  if (userCache && Date.now() - userCacheAt < 10 * 60_000) return userCache;
  const { members } = await slack('users.list', { limit: 500 });
  userCache = Object.fromEntries(
    (members || []).map(m => [m.id, m.profile?.display_name || m.real_name || m.name || m.id])
  );
  userCacheAt = Date.now();
  return userCache;
}

/* ---------- text cleanup ---------- */

export function clean(text, names = {}) {
  return String(text || '')
    .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<(https?:\/\/[^>]+)>/g, '$1')
    .replace(/<@([A-Z0-9]+)(\|[^>]*)?>/g, (_, id) => '@' + (names[id] || id))
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/:[a-z0-9_+-]+:/g, '')
    .replace(/[*`_]/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const toIso = ts => new Date(Number(String(ts).split('.')[0]) * 1000).toISOString();

/* ---------- conversations ---------- */

async function conversations(types) {
  const { channels } = await slack('conversations.list', {
    types, limit: 200, exclude_archived: true
  });
  return channels || [];
}

async function history(id, limit, oldest) {
  try {
    const { messages } = await slack('conversations.history', { channel: id, limit, oldest });
    return messages || [];
  } catch {
    return []; // ไม่ได้อยู่ในห้องนั้น หรือไม่มีสิทธิ์ — ข้ามไป
  }
}

/* ---------- public ---------- */

/** DM ล่าสุดที่คนอื่นส่งหาเรา */
export async function dms(limit = 12) {
  const [names, ims, me] = await Promise.all([
    users(),
    conversations('im'),
    slack('auth.test').then(r => r.user_id)
  ]);

  const rows = [];
  for (const im of ims.filter(c => !c.is_user_deleted).slice(0, 25)) {
    const msgs = await history(im.id, 5);
    msgs
      .filter(m => m.user && m.user !== me && m.text)
      .forEach(m => rows.push({
        chan: 'DM',
        isDm: true,
        author: names[m.user] || m.user,
        text: clean(m.text, names),
        ts: toIso(m.ts)
      }));
  }

  return rows.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, limit);
}

/** ความเคลื่อนไหวในช่องที่เราเป็นสมาชิก */
export async function feed({ days = 7, limit = 40 } = {}) {
  const oldest = Math.floor((Date.now() - days * 864e5) / 1000);
  const [names, chans] = await Promise.all([
    users(),
    conversations('public_channel,private_channel')
  ]);

  const mine = chans.filter(c => c.is_member).slice(0, 25);
  const rows = [];

  for (const c of mine) {
    const msgs = await history(c.id, 30, oldest);
    msgs
      .filter(m => m.text && m.subtype !== 'channel_join')
      .forEach(m => rows.push({
        chan: c.name,
        isDm: false,
        author: names[m.user] || m.bot_id || 'ไม่ทราบ',
        text: clean(m.text, names),
        ts: toIso(m.ts)
      }));
  }

  return rows
    .filter(r => r.text)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, limit);
}
