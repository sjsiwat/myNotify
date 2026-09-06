import { calendarClient } from './google.js';
import { holidaysInRange, wanPhraInRange } from './thaiCalendar.js';

/* Google เก็บเวลาเป็น instant อยู่แล้ว ตัวนี้ใช้ตอน "สร้าง" นัดที่มีเวลา
   เพื่อบอกว่า 09:00 ที่ผู้ใช้พิมพ์คือ 09:00 ของโซนไหน */
const TZ = process.env.CALENDAR_TZ || 'Asia/Bangkok';

/* ---------- แปลงวันเวลา ---------- */

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const isLocal = s => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(s || ''));

/** บวก/ลบวันบน 'YYYY-MM-DD' — คิดบนปฏิทินตรง ๆ ไม่ยุ่งกับ timezone ของเครื่อง */
function shiftDate(s, days) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** บวกชั่วโมงบน 'YYYY-MM-DDTHH:mm' — เลขหน้าปัดล้วน ๆ ไม่แปลงโซน */
function shiftHour(s, hours) {
  const [d, t] = String(s).split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, da, h + hours, mi)).toISOString().slice(0, 16);
}

/** ช่วงเวลาที่ต้องดึงของเดือนหนึ่ง — เผื่อหน้า-หลัง 7 วันให้ครบช่องที่ตารางเดือนโชว์ */
function windowOf(month) {
  const [y, m] = month.split('-').map(Number);
  return {
    timeMin: new Date(Date.UTC(y, m - 1, 1 - 7)).toISOString(),
    timeMax: new Date(Date.UTC(y, m, 1 + 7)).toISOString()
  };
}

/** ค่าจากฟอร์ม → start/end แบบที่ Google รับ */
function when({ allDay, start, end }) {
  if (allDay) {
    const s = isDate(start) ? start : String(start || '').slice(0, 10);
    if (!isDate(s)) throw new Error('วันเริ่มไม่ถูกรูปแบบ (ต้องเป็น YYYY-MM-DD)');
    let e = isDate(end) ? end : s;
    if (e < s) e = s;
    // end ของ Google แบบทั้งวันไม่รวมวันสุดท้าย — ที่ผู้ใช้กรอกคือวันสุดท้ายที่นับ จึงต้อง +1
    return { start: { date: s }, end: { date: shiftDate(e, 1) } };
  }

  if (!isLocal(start)) throw new Error('วันเวลาเริ่มไม่ถูกรูปแบบ (ต้องเป็น YYYY-MM-DDTHH:mm)');
  const e = isLocal(end) && end > start ? end : shiftHour(start, 1);
  return {
    start: { dateTime: start + ':00', timeZone: TZ },
    end:   { dateTime: e + ':00',     timeZone: TZ }
  };
}

/* ---------- รายชื่อปฏิทิน ---------- */

let listCache = null;
let listAt = 0;

async function calendars(cal) {
  if (listCache && Date.now() - listAt < 10 * 60_000) return listCache;

  const { data } = await cal.calendarList.list({ maxResults: 100, minAccessRole: 'reader' });
  const all = (data.items || []).map(c => ({
    id: c.id,
    name: c.summaryOverride || c.summary || c.id,
    color: c.backgroundColor || '#3a6ea5',
    primary: Boolean(c.primary),
    canWrite: c.accessRole === 'owner' || c.accessRole === 'writer',
    shown: c.selected === true || Boolean(c.primary)
  }));

  // เอาเฉพาะปฏิทินที่เปิดแสดงอยู่ใน Google Calendar จะได้เห็นตรงกัน
  // ถ้าไม่มีอันไหนถูกเปิดเลย (บางบัญชีไม่ส่ง selected มา) ก็เอาทั้งหมด
  const shown = all.filter(c => c.shown);
  listCache = (shown.length ? shown : all).map(({ shown: _, ...c }) => c);
  listAt = Date.now();
  return listCache;
}

/* ---------- แปลง event ให้เป็น shape ที่หน้าเว็บใช้ ---------- */

function norm(e, c) {
  const allDay = Boolean(e.start?.date);
  const endDate = allDay ? (e.end?.date || shiftDate(e.start.date, 1)) : null;
  return {
    id: e.id,
    calendarId: c.id,
    calendar: c.name,
    color: c.color,
    title: e.summary || '(ไม่มีชื่อ)',
    allDay,
    start: allDay ? e.start.date : e.start.dateTime,
    // ถอย 1 วันให้ end กลายเป็น "วันสุดท้ายที่นับ" ตรงกับที่คนอ่านเข้าใจ
    end: allDay ? shiftDate(endDate, -1) : (e.end?.dateTime || e.start.dateTime),
    location: e.location || '',
    description: String(e.description || '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
    url: e.htmlLink || '',
    meet: e.hangoutLink || '',
    guests: (e.attendees || []).length,
    recurring: Boolean(e.recurringEventId),
    canWrite: c.canWrite
  };
}

/* Google มีปฏิทินวันหยุดสาธารณะให้ทุกประเทศอยู่แล้ว (เช่น th.th#holiday@group.v.calendar.google.com)
   ถ้าผู้ใช้เปิดแสดงปฏิทินนี้อยู่ ให้ใช้ข้อมูลนี้แทนตาราง HOLIDAYS ที่เราแข็งไว้เอง — แม่นกว่าและไม่ต้องอัปเดตเองทุกปี */
const isHolidayCal = c => /#holiday@group\.v\.calendar\.google\.com$/i.test(c.id);

/** error ของ googleapis ให้อ่านรู้เรื่อง */
function fail(e, what) {
  const code = e?.code || e?.response?.status;
  if (code === 403) throw new Error(`ไม่มีสิทธิ์${what} — ปฏิทินนี้อาจแชร์มาแบบอ่านอย่างเดียว`);
  if (code === 404) throw new Error('ไม่พบนัดนี้ — อาจถูกลบไปแล้ว ลองรีเฟรช');
  throw new Error(e?.errors?.[0]?.message || e?.message || `${what}ไม่สำเร็จ`);
}

/* ---------- public ---------- */

/** นัดทั้งเดือน (เผื่อหัวท้าย 7 วัน) จากทุกปฏิทินที่เปิดแสดงอยู่ */
export async function month(key) {
  const cal = await calendarClient();
  if (!cal) return null;

  const cals = await calendars(cal);
  const { timeMin, timeMax } = windowOf(key);

  const lists = await Promise.all(cals.map(async c => {
    try {
      const { data } = await cal.events.list({
        calendarId: c.id, timeMin, timeMax,
        singleEvents: true,        // กางนัดที่ทำซ้ำออกเป็นครั้ง ๆ
        orderBy: 'startTime', maxResults: 250
      });
      return (data.items || []).filter(e => e.status !== 'cancelled').map(e => norm(e, c));
    } catch {
      return [];   // ปฏิทินที่อ่านไม่ได้ ข้ามไปเงียบ ๆ ดีกว่าพังทั้งหน้า
    }
  }));

  const holidayIds = new Set(cals.filter(isHolidayCal).map(c => c.id));
  const all = lists.flat();
  const events = all.filter(e => !holidayIds.has(e.calendarId))
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  // ถ้ามีปฏิทินวันหยุดของ Google อยู่ ให้ดึงมาเป็นวันหยุดแทนของแข็ง — ไม่งั้นค่อยถอยไปใช้ตาราง HOLIDAYS
  const liveHolidays = all.filter(e => holidayIds.has(e.calendarId))
    .map(e => ({ date: e.start.slice(0, 10), name: e.title }));

  const holidays = liveHolidays.length ? liveHolidays : holidaysInRange(timeMin, timeMax);
  const holidayDates = new Set(holidays.map(h => h.date));
  // วันที่ตรงกับวันหยุดอยู่แล้วไม่ต้องซ้อนจุดวันพระทับ (เช่นวันมาฆบูชาก็เป็นวันเพ็ญด้วย)
  const wanPhra = wanPhraInRange(timeMin, timeMax).filter(w => !holidayDates.has(w.date));

  const special = [
    ...holidays.map(h => ({ ...h, type: 'holiday' })),
    ...wanPhra.map(w => ({ ...w, type: 'wanphra' }))
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { month: key, tz: TZ, calendars: cals.filter(c => !isHolidayCal(c)), events, special };
}

export async function create(body = {}) {
  const cal = await calendarClient();
  if (!cal) return null;

  const title = String(body.title || '').trim();
  if (!title) throw new Error('ต้องมีชื่อนัด');

  try {
    const { data } = await cal.events.insert({
      calendarId: body.calendarId || 'primary',
      requestBody: {
        summary: title,
        location: String(body.location || '').trim() || undefined,
        description: String(body.description || '').trim() || undefined,
        ...when(body)
      }
    });
    return { id: data.id, url: data.htmlLink };
  } catch (e) { fail(e, 'เพิ่มนัด'); }
}

export async function update(body = {}) {
  const cal = await calendarClient();
  if (!cal) return null;

  const { calendarId, eventId } = body;
  if (!calendarId || !eventId) throw new Error('ไม่รู้ว่าจะแก้นัดไหน');

  const title = String(body.title || '').trim();
  if (!title) throw new Error('ต้องมีชื่อนัด');

  try {
    // patch ไม่ใช่ update — ฟิลด์ที่ไม่ได้ส่ง (แขก, การแจ้งเตือน, การทำซ้ำ) จะคงไว้เหมือนเดิม
    const { data } = await cal.events.patch({
      calendarId, eventId,
      requestBody: {
        summary: title,
        location: String(body.location || '').trim(),
        description: String(body.description || '').trim(),
        ...when(body)
      }
    });
    return { id: data.id, url: data.htmlLink };
  } catch (e) { fail(e, 'แก้นัด'); }
}

export async function remove({ calendarId, eventId } = {}) {
  const cal = await calendarClient();
  if (!cal) return null;
  if (!calendarId || !eventId) throw new Error('ไม่รู้ว่าจะลบนัดไหน');

  try {
    await cal.events.delete({ calendarId, eventId });
    return { ok: true };
  } catch (e) {
    // ลบซ้ำอันที่หายไปแล้ว ถือว่าสำเร็จ ไม่ต้องขึ้น error ให้ผู้ใช้งง
    if ((e?.code || e?.response?.status) === 410) return { ok: true };
    fail(e, 'ลบนัด');
  }
}

/** เรียกหลังแก้ข้อมูล — เผื่อผู้ใช้เพิ่ง add/remove ปฏิทินใน Google */
export function forgetCalendarList() {
  listCache = null;
}
