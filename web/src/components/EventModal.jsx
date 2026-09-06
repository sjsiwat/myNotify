import { useEffect, useState } from 'react'
import Modal, { ModalTitle, ModalActions } from './Modal'
import Button from './Button'
import { dayKey, hhmm, startOf, endOf } from '../lib/calendar'

const field = 'w-full font-inherit text-[13.5px] text-ink bg-surface border-2 border-line rounded-[5px] py-2 px-2.5 focus:outline-none focus:border-accent focus:shadow-[3px_3px_0_var(--color-line)]'
const label = 'block text-[11px] font-bold text-ink-2 uppercase tracking-[0.05em] mb-1'

/**
 * ฟอร์มเพิ่ม/แก้นัด — ev=null คือสร้างใหม่ที่วัน defaultDay, ev={...} คือแก้ไข
 * ปฏิทินที่เลือกได้จำกัดเฉพาะที่ canWrite=true และตอนแก้ไขจะล็อกช่องปฏิทินไว้
 * (ย้ายนัดข้ามปฏิทินต้องใช้ API คนละตัว)
 */
export default function EventModal({ open, ev, defaultDay, calendars, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => initial(ev, defaultDay))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const writable = (calendars || []).filter(c => c.canWrite)

  useEffect(() => {
    if (!open) return
    const base = initial(ev, defaultDay)
    if (!ev) base.calendarId = (writable.find(c => c.primary) || writable[0])?.id || ''
    setForm(base)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ev, defaultDay])

  if (!open) return null
  const calOptions = ev ? [{ id: ev.calendarId, name: ev.calendar }] : writable
  if (!writable.length && !ev) { onClose(); return null }

  const set = patch => setForm(f => ({ ...f, ...patch }))

  const submit = async e => {
    e.preventDefault()
    const { title, calendarId, allDay, sd, ed, st, et, location, description } = form
    if (!title.trim()) return setError('ใส่ชื่อนัดก่อน')
    if (!sd) return setError('เลือกวันเริ่มก่อน')
    const endDay = ed || sd
    if (allDay && endDay < sd) return setError('วันจบต้องไม่อยู่ก่อนวันเริ่ม')

    const start = allDay ? sd : `${sd}T${st || '09:00'}`
    const end = allDay ? endDay : `${endDay}T${et || '10:00'}`
    if (!allDay && end <= start) return setError('เวลาจบต้องอยู่หลังเวลาเริ่ม')

    const body = { calendarId, title: title.trim(), allDay, start, end, location: location.trim(), description: description.trim() }
    setSaving(true)
    try {
      await onSave(body, ev)
      onClose()
    } catch (e2) {
      setError(e2.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="evHead">
      <ModalTitle id="evHead">{ev ? 'แก้ไขนัด' : 'เพิ่มนัด'}</ModalTitle>
      <form onSubmit={submit}>
        <div className="px-[18px] mt-[13px]">
          <label className={label} htmlFor="evName">ชื่อนัด</label>
          <input id="evName" className={field} maxLength={200} autoComplete="off" required
            value={form.title} onChange={e => set({ title: e.target.value })} />
        </div>
        <div className="px-[18px] mt-[13px]">
          <label className={label}>ปฏิทิน</label>
          <select className={field + (ev ? ' bg-surface-2 text-ink-2' : '')} disabled={Boolean(ev)}
            value={form.calendarId} onChange={e => set({ calendarId: e.target.value })}>
            {calOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="px-[18px] mt-[13px]">
          <label className="flex items-center gap-2 text-[13px] text-ink-2 font-semibold cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-accent" checked={form.allDay} onChange={e => set({ allDay: e.target.checked })} />
            ทั้งวัน
          </label>
        </div>
        <div className="px-[18px] mt-[13px]">
          <label className={label}>เริ่ม</label>
          <div className="flex gap-2.5">
            <input type="date" className={field + ' flex-1 min-w-0'} required value={form.sd} onChange={e => set({ sd: e.target.value })} />
            {!form.allDay && <input type="time" step={300} className={field + ' flex-1 min-w-0'} value={form.st} onChange={e => set({ st: e.target.value })} />}
          </div>
        </div>
        <div className="px-[18px] mt-[13px]">
          <label className={label}>จบ</label>
          <div className="flex gap-2.5">
            <input type="date" className={field + ' flex-1 min-w-0'} value={form.ed} onChange={e => set({ ed: e.target.value })} />
            {!form.allDay && <input type="time" step={300} className={field + ' flex-1 min-w-0'} value={form.et} onChange={e => set({ et: e.target.value })} />}
          </div>
        </div>
        <div className="px-[18px] mt-[13px]">
          <label className={label} htmlFor="evLoc">สถานที่</label>
          <input id="evLoc" className={field} maxLength={300} autoComplete="off" value={form.location} onChange={e => set({ location: e.target.value })} />
        </div>
        <div className="px-[18px] mt-[13px]">
          <label className={label} htmlFor="evDesc">รายละเอียด</label>
          <textarea id="evDesc" className={field + ' resize-y min-h-[62px]'} maxLength={2000} value={form.description} onChange={e => set({ description: e.target.value })} />
        </div>
        {error && <p className="mx-[18px] mt-[13px] py-[13px] px-4 bg-accent-soft border-2 border-line rounded-[6px] text-[#7a2400] text-[12.5px] font-bold">{error}</p>}
        <ModalActions>
          {ev && <Button variant="danger" size="sm" type="button" onClick={() => onDelete(ev)}>ลบนัด</Button>}
          <Button variant="ghost" size="sm" type="button" className="ml-auto" onClick={onClose}>ยกเลิก</Button>
          <Button size="sm" type="submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </ModalActions>
      </form>
    </Modal>
  )
}

function initial(ev, defaultDay) {
  if (ev) {
    const allDay = Boolean(ev.allDay)
    const s = startOf(ev), e = endOf(ev)
    return {
      title: ev.title, calendarId: ev.calendarId, allDay,
      sd: dayKey(s), ed: dayKey(e),
      st: allDay ? '09:00' : hhmm(ev.start), et: allDay ? '10:00' : hhmm(ev.end),
      location: ev.location || '', description: ev.description || '',
    }
  }
  return { title: '', calendarId: '', allDay: false, sd: defaultDay, ed: defaultDay, st: '09:00', et: '10:00', location: '', description: '' }
}
