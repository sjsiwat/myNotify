const API = 'https://slack.com/api/';

/* รองรับหลาย workspace — user token ผูกกับ workspace เดียวเท่านั้น ข้ามไม่ได้
   ตั้งได้ทั้ง SLACK_USER_TOKEN (ตัวเดียว) และ/หรือ SLACK_USER_TOKENS (คั่นด้วย comma หลายตัว) */
function tokenList() {
  const many = String(process.env.SLACK_USER_TOKENS || '').split(',').map(s => s.trim()).filter(Boolean);
  const single = process.env.SLACK_USER_TOKEN?.trim();
  const all = single && !many.includes(single) ? [...many, single] : many;
  if (!all.length) throw new Error('ยังไม่ได้ตั้ง SLACK_USER_TOKEN ใน .env');
  return all;
}

async function slack(method, params = {}, token) {
  const url = new URL(API + method);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!json.ok) {
    // missing_scope บอกตรง ๆ ว่าต้องเพิ่ม scope ไหน
    throw new Error(`slack ${method}: ${json.error}${json.needed ? ` (ต้องการ scope: ${json.needed})` : ''}`);
  }
  return json;
}

/* ---------- users / team cache (แยกต่อ token เพราะ user id ซ้ำกันได้ข้าม workspace) ---------- */

const userCache = new Map();   // token -> { at, names }

async function users(token) {
  const hit = userCache.get(token);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.names;
  const { members } = await slack('users.list', { limit: 500 }, token);
  const names = Object.fromEntries(
    (members || []).map(m => [m.id, m.profile?.display_name || m.real_name || m.name || m.id])
  );
  userCache.set(token, { at: Date.now(), names });
  return names;
}

const teamCache = new Map();   // token -> ชื่อ workspace, ใช้ทำ label กันชื่อช่องชนกันข้าม workspace

async function teamName(token) {
  if (teamCache.has(token)) return teamCache.get(token);
  const name = await slack('team.info', {}, token).then(r => r.team?.name).catch(() => null);
  teamCache.set(token, name);
  return name;
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

/* ข้อความที่โพสต์ด้วย rich text editor หรือแนบไฟล์ (เช่น snippet) จะไม่มี m.text เลย
   เนื้อหาจริงอยู่ใน m.files[].preview หรือ m.blocks แทน — ไม่ดึงมาด้วยข้อความจะหายไปเงียบ ๆ */
function blockText(blocks) {
  const out = [];
  const walk = el => {
    if (!el) return;
    if (typeof el.text === 'string') out.push(el.text);
    else if (typeof el.text?.text === 'string') out.push(el.text.text);
    (el.elements || []).forEach(walk);
  };
  (blocks || []).forEach(walk);
  return out.join(' ');
}

function messageText(m) {
  if (m.text) return m.text;
  if (m.files?.length) {
    return m.files.map(f => {
      const preview = String(f.preview || '').replace(/\s+/g, ' ').trim();
      const name = f.title || f.name || 'ไฟล์แนบ';
      return preview ? `${name}: ${preview}` : name;
    }).join(' · ');
  }
  return blockText(m.blocks);
}

/* ---------- conversations ---------- */

async function conversations(types, token) {
  const { channels } = await slack('conversations.list', {
    types, limit: 200, exclude_archived: true
  }, token);
  return channels || [];
}

async function history(id, limit, oldest, token) {
  try {
    const { messages } = await slack('conversations.history', { channel: id, limit, oldest }, token);
    return messages || [];
  } catch {
    return []; // ไม่ได้อยู่ในห้องนั้น หรือไม่มีสิทธิ์ — ข้ามไป
  }
}

/* ---------- public ---------- */

/** DM ล่าสุดที่คนอื่นส่งหาเรา — วนทุก workspace ที่ตั้งไว้พร้อมกัน */
export async function dms(limit = 12) {
  const tokens = tokenList();
  const multi = tokens.length > 1;
  const rows = [];

  await Promise.all(tokens.map(async token => {
    const [names, ims, me, team] = await Promise.all([
      users(token),
      conversations('im', token),
      slack('auth.test', {}, token).then(r => r.user_id),
      multi ? teamName(token) : null
    ]);

    for (const im of ims.filter(c => !c.is_user_deleted).slice(0, 25)) {
      const msgs = await history(im.id, 5, undefined, token);
      msgs
        .filter(m => m.user && m.user !== me)
        .forEach(m => {
          const text = clean(messageText(m), names);
          if (!text) return;
          rows.push({
            chan: multi && team ? `DM · ${team}` : 'DM',
            isDm: true,
            author: names[m.user] || m.user,
            text,
            ts: toIso(m.ts)
          });
        });
    }
  }));

  return rows.sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, limit);
}

/** ความเคลื่อนไหวในช่องที่เราเป็นสมาชิก — วนทุก workspace ที่ตั้งไว้พร้อมกัน */
export async function feed({ days = 7, limit = 40 } = {}) {
  const tokens = tokenList();
  const multi = tokens.length > 1;
  const oldest = Math.floor((Date.now() - days * 864e5) / 1000);
  const rows = [];

  await Promise.all(tokens.map(async token => {
    const [names, chans, team] = await Promise.all([
      users(token),
      conversations('public_channel,private_channel', token),
      multi ? teamName(token) : null
    ]);

    const mine = chans.filter(c => c.is_member).slice(0, 25);
    for (const c of mine) {
      const msgs = await history(c.id, 30, oldest, token);
      msgs
        .filter(m => m.subtype !== 'channel_join')
        .forEach(m => {
          const text = clean(messageText(m), names);
          if (!text) return;
          rows.push({
            // มีมากกว่า 1 workspace ต้องกันชื่อช่องชนกัน เลยเติมชื่อ workspace นำหน้า
            chan: multi && team ? `${team}/${c.name}` : c.name,
            isDm: false,
            author: names[m.user] || m.bot_id || 'ไม่ทราบ',
            text,
            ts: toIso(m.ts)
          });
        });
    }
  }));

  return rows
    .filter(r => r.text)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts))
    .slice(0, limit);
}
