/* ---------- วันหยุดราชการ ---------- */

/* ข้อมูลนิ่ง ไม่ได้คำนวณเอง ต้องเติมปีใหม่เข้ามาเองทุกปี
   ปี 2569 อ้างอิงปฏิทินวันหยุดราชการที่ ครม. ประกาศ (ตรวจสอบผ่านข่าวเมื่อ ก.ย. 2569) — ปีอื่นที่ไม่มีในตารางนี้จะไม่มีวันหยุดขึ้นเลย ไม่ error */
const HOLIDAYS = {
  2026: [
    ['01-01', 'วันขึ้นปีใหม่'],
    ['01-02', 'วันหยุดพิเศษ (ราชการ)'],
    ['03-03', 'วันมาฆบูชา'],
    ['04-06', 'วันจักรี'],
    ['04-13', 'วันสงกรานต์'],
    ['04-14', 'วันสงกรานต์'],
    ['04-15', 'วันสงกรานต์'],
    ['05-01', 'วันแรงงานแห่งชาติ'],
    ['05-04', 'วันฉัตรมงคล'],
    ['05-09', 'วันพืชมงคล'],
    ['05-31', 'วันวิสาขบูชา'],
    ['06-01', 'ชดเชยวันวิสาขบูชา'],
    ['06-03', 'วันเฉลิมพระชนมพรรษาพระราชินี'],
    ['07-28', 'วันเฉลิมพระชนมพรรษา ร.10'],
    ['07-29', 'วันอาสาฬหบูชา'],
    ['07-30', 'วันเข้าพรรษา'],
    ['08-12', 'วันแม่แห่งชาติ'],
    ['10-13', 'วันคล้ายวันสวรรคต ร.9'],
    ['10-23', 'วันปิยมหาราช'],
    ['12-05', 'วันพ่อแห่งชาติ'],
    ['12-07', 'ชดเชยวันพ่อแห่งชาติ'],
    ['12-10', 'วันรัฐธรรมนูญ'],
    ['12-31', 'วันสิ้นปี']
  ]
};

function holidaysOf(year) {
  return (HOLIDAYS[year] || []).map(([md, name]) => ({ date: `${year}-${md}`, name }));
}

/** วันหยุดราชการที่อยู่ในช่วง [timeMin, timeMax) — ทั้งสองค่าเป็น ISO string */
export function holidaysInRange(timeMin, timeMax) {
  const y1 = new Date(timeMin).getUTCFullYear();
  const y2 = new Date(timeMax).getUTCFullYear();
  const years = y1 === y2 ? [y1] : [y1, y2];
  const from = timeMin.slice(0, 10), to = timeMax.slice(0, 10);
  return years.flatMap(holidaysOf).filter(h => h.date >= from && h.date <= to);
}

/* ---------- วันพระ ---------- */

/* คำนวณจากคาบจันทรคติจริง (ประมาณตำแหน่งดวงจันทร์ 4 จุดต่อเดือน: ขึ้น 8 ค่ำ, ขึ้น 15 ค่ำ, แรม 8 ค่ำ, แรม 14/15 ค่ำ
   ≈ ปฐมบท, จันทร์เพ็ญ, ตติยบท, จันทร์ดับ ตามหลักดาราศาสตร์) ไม่ใช่ปฏิทินจันทรคติไทยแบบราชการที่มีเดือนอธิกมาส
   จึงอาจคลาดเคลื่อนจากประกาศทางการได้ ±1 วันในบางเดือน — ใช้เป็นตัวประมาณ ไม่ใช่ค่าทางการ */
const SYNODIC = 29.530588853;               // ความยาวเฉลี่ยของเดือนจันทรคติ (วัน)
const REF_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);   // เดือนมืดอ้างอิงที่รู้ค่าแน่นอน
const BKK_OFFSET_MS = 7 * 3600_000;         // ใช้เวลาไทย (UTC+7) ตัดสินว่าเป็น "วันที่" ไหน

/** วันพระ (เลขวันที่ในเดือน) ของเดือนปฏิทินที่ระบุ — ตรวจว่าดวงจันทร์ผ่านจุดแบ่ง 1/4 คาบระหว่างวันนั้นหรือไม่ */
function wanPhraOf(year, month /* 1-12 */) {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const QUARTER = SYNODIC / 4;
  const out = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const startUtc = Date.UTC(year, month - 1, d) - BKK_OFFSET_MS;
    const ageStart = (startUtc - REF_NEW_MOON_UTC) / 86400_000;
    const ageEnd = ageStart + 1;
    if (Math.floor(ageStart / QUARTER) !== Math.floor(ageEnd / QUARTER)) out.push(d);
  }
  return out;
}

/** วันพระที่อยู่ในช่วง [timeMin, timeMax) — เดินทีละเดือนเผื่อช่วงคาบเกี่ยวปี/เดือนถัดไป */
export function wanPhraInRange(timeMin, timeMax) {
  const from = timeMin.slice(0, 10), to = timeMax.slice(0, 10);
  const start = new Date(timeMin), end = new Date(timeMax);
  let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1;
  const endY = end.getUTCFullYear(), endM = end.getUTCMonth() + 1;
  const out = [];

  while (y < endY || (y === endY && m <= endM)) {
    wanPhraOf(y, m).forEach(d => {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (date >= from && date <= to) out.push({ date, name: 'วันพระ' });
    });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
