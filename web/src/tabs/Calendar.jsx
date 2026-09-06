import { useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Kpi, { KpiGrid } from '../components/Kpi'
import CalendarGrid from '../components/CalendarGrid'
import EventModal from '../components/EventModal'
import { Empty, Skeleton, ErrorNote, Gate } from '../components/Misc'
import { useDashboard } from '../state/DashboardContext'
import { src } from '../lib/api'
import { dayKey, monthKey, evWhen, evKey, groupByDay, upcoming, startOf } from '../lib/calendar'

export default function Calendar() {
  const { calMonth, calData, calGate, calError, loadCalendar } = useDashboard()
  const [selDay, setSelDay] = useState(dayKey(new Date()))
  const [modal, setModal] = useState({ open: false, ev: null })

  if (calError) return <ErrorNote>โหลดปฏิทินไม่สำเร็จ: {calError}</ErrorNote>
  if (calGate) return <Gate message={calGate.message} actionHref={calGate.authUrl} actionLabel="ให้สิทธิ์ปฏิทิน" />
  if (!calData) return <Skeleton>กำลังโหลดปฏิทิน…</Skeleton>

  const events = calData.events || []
  const by = groupByDay(events)
  const dayList = by.get(selDay) || []
  const today = dayKey(new Date())
  const todayList = by.get(today) || []
  const inMonth = events.filter(e => dayKey(startOf(e)).slice(0, 7) === calMonth).length
  const next = upcoming(events, 1)[0]

  const gotoMonth = async (m) => {
    await loadCalendar(m)
    if (!selDay.startsWith(m)) setSelDay(m + '-01')
  }
  const shiftMonth = step => {
    const [y, m] = calMonth.split('-').map(Number)
    gotoMonth(monthKey(new Date(y, m - 1 + step, 1)))
  }
  const goToday = () => { setSelDay(today); gotoMonth(monthKey(new Date())) }

  const saveEvent = async (body, editing) => {
    if (editing) await src.calUpdate({ ...body, eventId: editing.id })
    else await src.calCreate(body)
    setSelDay(body.start.slice(0, 10))
    await loadCalendar(body.start.slice(0, 7))
  }

  const deleteEvent = async (ev) => {
    const extra = ev.recurring ? '\n(เป็นนัดที่ทำซ้ำ — จะลบเฉพาะครั้งนี้)' : ''
    if (!confirm(`ลบนัด "${ev.title}" ?${extra}`)) return
    try {
      await src.calDelete({ calendarId: ev.calendarId, eventId: ev.id })
      setModal({ open: false, ev: null })
      await loadCalendar(calMonth)
    } catch (e) {
      alert('ลบไม่สำเร็จ: ' + e.message)
    }
  }

  const monthLabel = new Date(calMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
  const dayLabel = new Date(selDay).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <KpiGrid>
        <Kpi label="นัดเดือนนี้" value={inMonth} note={`${(calData.calendars || []).length} ปฏิทิน`} />
        <Kpi label="วันนี้" value={todayList.length} highlight={todayList.length > 0} note={todayList.length ? todayList[0].title : 'ว่างทั้งวัน'} />
        <Kpi label="นัดถัดไป" valueSize="text-[21px]"
          value={next ? startOf(next).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '—'}
          note={next ? `${next.title} · ${evWhen(next)}` : 'ไม่มีนัดข้างหน้าในช่วงนี้'} />
      </KpiGrid>

      <Card>
        <div className="flex items-center gap-2 py-2.5 px-4 border-b-[3px] border-line flex-wrap">
          <span className="font-display text-[15px] font-bold tracking-[-0.01em] mr-auto uppercase">{monthLabel}</span>
          <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)} title="เดือนก่อน">‹</Button>
          <Button variant="ghost" size="sm" onClick={goToday}>วันนี้</Button>
          <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)} title="เดือนถัดไป">›</Button>
          <Button size="sm" onClick={() => setModal({ open: true, ev: null })}>+ เพิ่มนัด</Button>
        </div>
        <CalendarGrid
          month={calMonth} events={events} special={calData.special} selected={selDay}
          onSelect={setSelDay}
          onOpenEvent={e => e.canWrite ? setModal({ open: true, ev: e }) : null}
        />
        <div className="text-xs text-ink-2 py-2.5 px-4 bg-surface-2 border-t-[3px] border-line">
          <span className="text-accent">■</span> วันหยุดราชการ &nbsp; <span className="text-amber">◯</span> วันพระ (ประมาณจากดวงจันทร์ ± 1 วัน)
        </div>
      </Card>

      <Card title="รายละเอียดนัด" hint={dayLabel}>
        {!dayList.length
          ? <Empty>ไม่มีนัดในวันนี้ — กด "+ เพิ่มนัด" เพื่อจดไว้</Empty>
          : dayList.map(e => (
            <EventDetailRow key={evKey(e)} e={e} onEdit={() => setModal({ open: true, ev: e })} onDelete={() => deleteEvent(e)} />
          ))}
        <div className="text-xs text-ink-2 py-2.5 px-4 bg-surface-2 border-t-[3px] border-line">
          จากทุกปฏิทินที่เปิดแสดงอยู่ — แก้/ลบนัดที่ทำซ้ำมีผลเฉพาะครั้งนั้น
        </div>
      </Card>

      <EventModal
        open={modal.open} ev={modal.ev} defaultDay={selDay} calendars={calData.calendars}
        onClose={() => setModal({ open: false, ev: null })}
        onSave={saveEvent}
        onDelete={deleteEvent}
      />
    </div>
  )
}

function EventDetailRow({ e, onEdit, onDelete }) {
  return (
    <div className="flex gap-3 py-3 px-4 border-b border-line-soft last:border-0 hover:bg-surface-2">
      <span className="w-[104px] flex-none font-mono text-[12px] font-bold text-ink-2">{evWhen(e)}</span>
      <span className="flex-1 min-w-0">
        <b className="block text-[13.5px] font-bold">{e.title}</b>
        <span className="text-[12px] text-ink-3 mt-0.5 flex gap-1.5 flex-wrap items-center">
          <span className="w-[9px] h-[9px] rounded-full flex-none border border-line" style={{ background: e.color }} />
          {e.calendar}
          {e.location && <span>· {e.location}</span>}
          {e.guests ? <span>· {e.guests} คน</span> : null}
          {e.recurring && <span className="inline-block text-[10.5px] font-bold py-0.5 px-2 rounded-[4px] border-2 border-line bg-surface-2 text-ink-2">ทำซ้ำ</span>}
          {e.meet && <a className="text-accent font-bold hover:underline" href={e.meet} target="_blank" rel="noopener noreferrer">Meet</a>}
        </span>
        {e.description && <div className="text-[12.5px] text-ink-2 line-clamp-2 mt-1">{e.description}</div>}
      </span>
      <span className="flex-none flex gap-1 items-start">
        {e.url && <a className="text-[12px] font-bold text-ink-3 py-0.5 px-1 hover:underline" href={e.url} target="_blank" rel="noopener noreferrer">เปิด</a>}
        {e.canWrite ? (
          <>
            <button className="text-[12px] font-bold text-accent py-0.5 px-1 hover:underline" onClick={onEdit}>แก้ไข</button>
            <button className="text-[12px] font-bold text-ink-3 py-0.5 px-1 hover:underline" onClick={onDelete}>ลบ</button>
          </>
        ) : <span className="inline-block text-[10.5px] font-bold py-0.5 px-2 rounded-[4px] border-2 border-line bg-surface-2 text-ink-2">อ่านอย่างเดียว</span>}
      </span>
    </div>
  )
}
