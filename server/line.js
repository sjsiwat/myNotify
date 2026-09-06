const API = 'https://api.line.me/v2/bot/message/push';

function creds() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const to = process.env.LINE_USER_ID;
  if (!token || !to) throw new Error('ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN หรือ LINE_USER_ID ใน .env');
  return { token, to };
}

/** ส่งข้อความตัวหนังสือล้วนเข้า LINE ของ LINE_USER_ID — ใช้ channel เดียวกับบอทตัวอื่นที่มีอยู่แล้วก็ได้ */
export async function push(text) {
  const { token, to } = creds();
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`line push: ${res.status} ${body.message || res.statusText}`);
  }
  return { ok: true };
}
