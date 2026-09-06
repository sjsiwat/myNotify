export const pad2 = n => String(n).padStart(2, '0')
export const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
export const monthKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
export const hhmm = iso => { const d = new Date(iso); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) }

/** 'YYYY-MM-DD' → Date เที่ยงคืนเวลาท้องถิ่น (ห้ามใช้ new Date('2026-08-04') ตรง ๆ เพราะ JS อ่านเป็น UTC แล้ววันจะเลื่อน) */
export function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s)
}
export const startOf = e => (e.allDay ? parseDay(e.start) : new Date(e.start))
export const endOf = e => (e.allDay ? parseDay(e.end) : new Date(e.end))

/** ทุกวันที่นัดหนึ่งกินพื้นที่ — นัดข้ามวันจะโผล่ในทุกช่องที่มันคร่อม */
export function spanDays(e) {
  const s = startOf(e), en = endOf(e)
  const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate())
  const last = new Date(en.getFullYear(), en.getMonth(), en.getDate())
  if (!e.allDay && last > cur && en.getHours() === 0 && en.getMinutes() === 0) last.setDate(last.getDate() - 1)
  const out = []
  for (let i = 0; i < 90 && cur <= last; i++) { out.push(dayKey(cur)); cur.setDate(cur.getDate() + 1) }
  return out.length ? out : [dayKey(s)]
}

export const evKey = e => e.calendarId + '|' + e.id

export function evWhen(e, withDate) {
  const d = startOf(e).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
  if (e.allDay) return withDate ? d + ' · ทั้งวัน' : 'ทั้งวัน'
  return withDate ? `${d} ${hhmm(e.start)}` : `${hhmm(e.start)} – ${hhmm(e.end)}`
}

/** นัดที่ยังไม่ผ่าน เรียงจากใกล้สุด */
export function upcoming(events, n) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return (events || [])
    .filter(e => (e.allDay ? endOf(e) >= startOfToday : endOf(e) >= now))
    .sort((a, b) => startOf(a) - startOf(b))
    .slice(0, n)
}

export function groupByDay(events) {
  const by = new Map()
  ;(events || []).forEach(e => spanDays(e).forEach(k => {
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(e)
  }))
  by.forEach(list => list.sort((a, b) =>
    (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1) || String(a.start).localeCompare(String(b.start))))
  return by
}
