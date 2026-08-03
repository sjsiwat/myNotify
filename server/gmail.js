import { gmailClient } from './google.js';

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

/** เดินลง MIME tree เก็บเฉพาะ text/plain */
function plainText(part, out = []) {
  if (!part) return out;
  if (part.mimeType === 'text/plain' && part.body?.data) {
    out.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
  }
  (part.parts || []).forEach(p => plainText(p, out));
  return out;
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
      name: displayName(from),
      domain: domainOf(from),
      subject: header(m, 'Subject'),
      date: new Date(Number(m.internalDate)).toISOString(),
      unread: (m.labelIds || []).includes('UNREAD'),
      isLinkedIn: /linkedin\.com/i.test(from)
    };
  });
}

/* ---------- spending ---------- */

const AMT_RE =
  /(?:US\s*)?\$\s*([0-9][\d,]*(?:\.\d{1,2})?)|฿\s*([0-9][\d,]*(?:\.\d{1,2})?)|([0-9][\d,]*(?:\.\d{1,2})?)\s*(?:บาท|THB)\b/gi;

/** หยิบตัวเลขที่มากที่สุดในบิล — ปกติคือยอดรวม */
export function extractAmount(text) {
  if (!text) return null;
  const usd = [], thb = [];
  let m;
  AMT_RE.lastIndex = 0;
  while ((m = AMT_RE.exec(text)) !== null) {
    if (m[1]) usd.push(parseFloat(m[1].replace(/,/g, '')));
    else if (m[2]) thb.push(parseFloat(m[2].replace(/,/g, '')));
    else if (m[3]) thb.push(parseFloat(m[3].replace(/,/g, '')));
  }
  const pick = a => a.filter(v => v > 0 && v < 1e7).sort((x, y) => y - x)[0];
  const u = pick(usd), t = pick(thb);
  if (u != null) return { cur: 'USD', val: u };
  if (t != null) return { cur: 'THB', val: t };
  return null;
}

const SPEND_Q =
  'in:anywhere {subject:receipt subject:invoice subject:renew subject:payment ' +
  'subject:billing subject:ใบเสร็จ subject:"has been charged"} -in:draft -in:sent';

export async function spend(limit = 12) {
  const gmail = await gmailClient();
  if (!gmail) return null;

  const { data } = await gmail.users.messages.list({
    userId: 'me', q: SPEND_Q, maxResults: 40
  });

  const ids = (data.messages || []).slice(0, limit);
  const bills = [];

  for (const { id } of ids) {
    let msg;
    try {
      msg = (await gmail.users.messages.get({ userId: 'me', id, format: 'full' })).data;
    } catch {
      continue;
    }
    const body = plainText(msg.payload).join('\n');
    const amt = extractAmount(body);
    if (!amt) continue;

    const from = emailOf(header(msg, 'From'));
    bills.push({
      name: displayName(from),
      domain: domainOf(from),
      subject: header(msg, 'Subject'),
      date: new Date(Number(msg.internalDate)).toISOString(),
      ...amt
    });
  }

  return { bills, scanned: ids.length };
}
