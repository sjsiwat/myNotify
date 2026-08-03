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
 * ใบเสร็จจากธนาคารไทยหลายเจ้าส่งมาเป็น text/html อย่างเดียว ไม่มี text/plain เลย
 * ถ้าเก็บแต่ text/plain จะได้ค่าว่างแล้วอ่านยอดไม่ได้ทั้งฉบับ
 */
export function bodyText(payload) {
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

const NUM = '([0-9][\\d,]*(?:\\.\\d{1,2})?)';

/* ตัวเลขที่มีสัญลักษณ์เงินติดอยู่ — หมายเหตุ: ห้ามใช้ \b ปิดท้ายคำไทย
   เพราะ \b ใน JS นับเฉพาะ [A-Za-z0-9_] ทำให้ "643.75 บาท " ไม่ match */
const CUR_RE = new RegExp(
  `(?:US\\s*)?\\$\\s*${NUM}` +
  `|฿\\s*${NUM}` +
  `|${NUM}\\s*(?:บาท|บ\\.|THB\\b)`, 'gi');

/* คำที่บอกว่าตัวเลขถัดไปคือยอดที่ถูกเรียกเก็บจริง */
const LABEL_RE = new RegExp(
  '(?:ยอดชำระ|ยอดรวม|ยอดเงิน|รวมชำระ(?:ทั้งหมด)?|จำนวนเงิน|จำนวน|ราคารวม' +
  '|grand\\s*total|total(?:\\s*amount)?|amount(?:\\s*(?:charged|paid|due))?|charged)' +
  `\\s*(?:[:=]|คือ)?\\s*(?:฿|\\$|THB|USD)?\\s*${NUM}\\s*(฿|\\$|บาท|บ\\.|THB|USD)?`, 'gi');

/* ตัวเลขที่อยู่ใกล้คำพวกนี้ไม่ใช่ยอดที่จ่าย — เช่น "วงเงินคงเหลือใช้ได้ 19,511.80 บ." */
const NOT_A_CHARGE = /วงเงิน|คงเหลือ|ยอดยกมา|balance|available|remaining|limit|คะแนน|point|ส่วนลด|discount|ค่าธรรมเนียม|fee/i;

const toNum = s => parseFloat(String(s).replace(/,/g, ''));
const sane = v => v > 0 && v < 1e7;

/** เดาสกุลเงินจากทั้งฉบับ เมื่อตัวเลขนั้นไม่มีสัญลักษณ์ติดมา */
function guessCurrency(text) {
  if (/฿|บาท|\bบ\.|\bTHB\b/.test(text)) return 'THB';
  if (/\$|\bUSD\b/.test(text)) return 'USD';
  return 'THB';   // ใบเสร็จภาษาไทยที่ไม่ระบุสกุล ส่วนใหญ่เป็นบาท
}
const curOf = sym =>
  !sym ? null : /฿|บาท|บ\.|THB/i.test(sym) ? 'THB' : 'USD';

/**
 * อ่านยอดเงินจากเนื้อความใบเสร็จ
 *
 * ลำดับความน่าเชื่อถือ:
 *   1. ตัวเลขที่มีคำกำกับว่าเป็นยอดชำระ (ยอดชำระ / จำนวนเงิน / Total / Amount)
 *      แม่นกว่ามาก เพราะบิลบัตรเครดิตมักมี "วงเงินคงเหลือ" ที่มากกว่ายอดจริง
 *   2. ถ้าไม่มีคำกำกับ ค่อยถอยไปใช้ตัวเลขที่มีสัญลักษณ์เงิน แล้วหยิบตัวที่มากสุด
 */
export function extractAmount(text) {
  if (!text) return null;

  const labelled = [];
  let m;
  LABEL_RE.lastIndex = 0;
  while ((m = LABEL_RE.exec(text)) !== null) {
    // ดูข้อความข้างหน้าเผื่อเป็น "วงเงินคงเหลือ" หรือ "ส่วนลด"
    if (NOT_A_CHARGE.test(text.slice(Math.max(0, m.index - 24), m.index + m[0].length))) continue;
    const val = toNum(m[1]);
    if (sane(val)) labelled.push({ val, cur: curOf(m[2]) });
  }

  if (labelled.length) {
    const best = labelled.sort((a, b) => b.val - a.val)[0];
    return { cur: best.cur || guessCurrency(text), val: best.val };
  }

  const usd = [], thb = [];
  CUR_RE.lastIndex = 0;
  while ((m = CUR_RE.exec(text)) !== null) {
    if (m[1]) usd.push(toNum(m[1]));
    else if (m[2]) thb.push(toNum(m[2]));
    else if (m[3]) thb.push(toNum(m[3]));
  }
  const pick = a => a.filter(sane).sort((x, y) => y - x)[0];
  const u = pick(usd), t = pick(thb);
  if (u != null) return { cur: 'USD', val: u };
  if (t != null) return { cur: 'THB', val: t };
  return null;
}

/* ธนาคารไทยไม่ได้ใช้คำอังกฤษเลย เช่น "แจ้งรายการชำระเงินสำเร็จ" ของ CardX
   จึงต้องใส่คำไทยด้วย ไม่งั้นบิลธนาคารหลุดหมด */
const SPEND_Q =
  'in:anywhere {' +
  'subject:receipt subject:invoice subject:renew subject:payment subject:billing ' +
  'subject:"has been charged" ' +
  'subject:ใบเสร็จ subject:ชำระเงิน subject:ชำระค่า subject:โอนเงิน ' +
  'subject:แจ้งรายการ subject:เติมเงิน subject:ค่าสินค้า' +
  '} -in:draft -in:sent newer_than:1y';   // กราฟรายเดือนจะได้ไม่กินช่วงหลายปี

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
    const body = bodyText(msg.payload);
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
