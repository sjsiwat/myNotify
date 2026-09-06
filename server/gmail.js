import { gmailClient, hasScope, GMAIL_SCOPE } from './google.js';

/* ---------- helpers ---------- */

const header = (msg, name) =>
  msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

const emailOf = s => (String(s).match(/<([^>]+)>/)?.[1] || String(s)).trim().toLowerCase();

export const displayName = addr => {
  const local = String(addr || '').split('@')[0];
  const cleaned = local
    .replace(/[._+-]/g, ' ')
    .replace(/noreply|no reply|notifications?|updates?|info|hello|team|mail|invoice|statements/gi, '')
    .trim();
  return cleaned || String(addr || '').split('@')[1] || 'ไม่ทราบ';
};

export const domainOf = addr =>
  (String(addr || '').split('@')[1] || '').replace(/^(mail|email|m|e)\./, '');

/** เดินลง MIME tree เก็บ part ตาม mimeType ที่ขอ */
function collect(part, mime, out = []) {
  if (!part) return out;
  if (part.mimeType === mime && part.body?.data) {
    out.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
  }
  (part.parts || []).forEach(p => collect(p, mime, out));
  return out;
}

const stripHtml = html => html
  .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<(br|\/tr|\/p|\/div|\/td)[^>]*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));

/**
 * เนื้อความของอีเมลเป็นข้อความล้วน
 * บางอีเมลส่งมาเป็น text/html อย่างเดียว ไม่มี text/plain เลย
 * ถ้าเก็บแต่ text/plain จะได้ค่าว่างแล้วอ่านเนื้อหาไม่ได้ทั้งฉบับ
 */
function bodyText(payload) {
  const plain = collect(payload, 'text/plain').join('\n').trim();
  if (plain) return plain;
  return stripHtml(collect(payload, 'text/html').join('\n'));
}

/* ---------- summary ---------- */

export async function summary() {
  const gmail = await gmailClient();
  if (!gmail) return null;

  const { data } = await gmail.users.labels.list({ userId: 'me' });
  const detailed = await Promise.all(
    (data.labels || []).map(l =>
      gmail.users.labels.get({ userId: 'me', id: l.id }).then(r => r.data).catch(() => l)
    )
  );

  const sys = Object.fromEntries(detailed.filter(l => l.type === 'system').map(l => [l.id, l]));
  const labels = detailed
    .filter(l => l.type === 'user' && (l.threadsTotal || 0) > 0)
    .map(l => ({
      name: l.name,
      threads: l.threadsTotal || 0,
      messages: l.messagesTotal || 0,
      unread: l.threadsUnread || 0,
      color: l.color?.backgroundColor || null
    }))
    .sort((a, b) => b.threads - a.threads);

  return {
    inbox: sys.INBOX?.threadsTotal || 0,
    unread: sys.UNREAD?.threadsTotal || 0,
    trash: sys.TRASH?.threadsTotal || 0,
    labels
  };
}

/* ---------- inbox ---------- */

export async function inbox(limit = 40) {
  const gmail = await gmailClient();
  if (!gmail) return null;

  const { data } = await gmail.users.messages.list({
    userId: 'me', q: 'in:inbox', maxResults: limit
  });

  const msgs = await Promise.all(
    (data.messages || []).map(m =>
      gmail.users.messages
        .get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] })
        .then(r => r.data)
        .catch(() => null)
    )
  );

  return msgs.filter(Boolean).map(m => {
    const from = emailOf(header(m, 'From'));
    return {
      id: m.id,
      name: displayName(from),
      domain: domainOf(from),
      subject: header(m, 'Subject'),
      date: new Date(Number(m.internalDate)).toISOString(),
      unread: (m.labelIds || []).includes('UNREAD'),
      isLinkedIn: /linkedin\.com/i.test(from)
    };
  });
}

/** เนื้อหาเต็มของอีเมลฉบับเดียว — ใช้ตอนกดเปิดอ่านจากรายการ */
export async function read(id) {
  const gmail = await gmailClient();
  if (!gmail) return null;

  const { data: msg } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
  const from = emailOf(header(msg, 'From'));
  return {
    id: msg.id,
    name: displayName(from),
    from: header(msg, 'From'),
    subject: header(msg, 'Subject'),
    date: new Date(Number(msg.internalDate)).toISOString(),
    body: bodyText(msg.payload).slice(0, 20_000)   // กันอีเมลยาวผิดปกติทำหน้าเว็บอืด
  };
}

/* ---------- แก้ไขอีเมล (อ่านแล้ว / ลบ) ---------- */

const MAX_BATCH = 50;   // เท่ากับเพดานที่ inbox() ดึงมาแสดง กันเผลอส่ง id เยอะเกินจำเป็นในคำขอเดียว

function pickIds(list) {
  const arr = Array.isArray(list) ? list.filter(Boolean).slice(0, MAX_BATCH) : [];
  if (!arr.length) throw new Error('ไม่มีอีเมลที่เลือก');
  return arr;
}

/** token เก่าที่ออกก่อนเพิ่มสิทธิ์แก้ไข (gmail.modify) จะยังทำสองอย่างนี้ไม่ได้ */
async function assertWritable() {
  if (!(await hasScope(GMAIL_SCOPE))) {
    throw new Error('ต้องให้สิทธิ์แก้ไขอีเมลก่อน — กด "เชื่อม Gmail" ใหม่อีกครั้งในแท็บ "เชื่อมต่ออื่น ๆ"');
  }
}

/** เอา label UNREAD ออก — ทำเครื่องหมายว่าอ่านแล้ว */
export async function markRead(messageIds) {
  const gmail = await gmailClient();
  if (!gmail) return null;
  await assertWritable();
  await gmail.users.messages.batchModify({
    userId: 'me',
    requestBody: { ids: pickIds(messageIds), removeLabelIds: ['UNREAD'] }
  });
  return { ok: true };
}

/** ย้ายเข้าถังขยะ — กู้คืนได้ใน Gmail เอง ไม่ใช่ลบถาวร */
export async function trash(messageIds) {
  const gmail = await gmailClient();
  if (!gmail) return null;
  await assertWritable();
  await Promise.all(pickIds(messageIds).map(id => gmail.users.messages.trash({ userId: 'me', id })));
  return { ok: true };
}
