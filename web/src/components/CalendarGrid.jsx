import { dayKey, hhmm, groupByDay } from '../lib/calendar'

const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

export default function CalendarGrid({ month, events, special, selected, onSelect, onOpenEvent }) {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const gridStart = new Date(y, m - 1, 1 - first.getDay())
  const cellCount = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7) * 7

  const by = groupByDay(events)
  const specialByDay = new Map((special || []).map(s => [s.date, s]))
  const today = dayKey(new Date())

  const cells = []
  for (let i = 0; i < cellCount; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    const k = dayKey(d)
    const list = by.get(k) || []
    const show = list.slice(0, 3)
    const sp = specialByDay.get(k)
    const outOfMonth = d.getMonth() !== m - 1
    cells.push(
      <div
        key={k}
        onClick={() => onSelect(k)}
        title={sp ? sp.name : ''}
        className={`min-h-[96px] border-r border-b border-line-soft [&:nth-child(7n)]:border-r-0 p-[5px_5px_7px] cursor-pointer flex flex-col gap-0.5 min-w-0 hover:bg-surface-2 transition-colors
          ${outOfMonth ? 'bg-[#ede2c8]' : ''} ${k === selected ? 'bg-accent-soft' : ''} ${sp?.type === 'holiday' ? 'bg-[#ffe3d1]' : ''} ${sp?.type === 'holiday' && k === selected ? 'bg-[#ffc9a8]' : ''}`}
      >
        <span
          className={`text-[12px] font-bold w-[22px] h-[22px] grid place-items-center rounded-full flex-none font-mono tabular-nums
            ${outOfMonth ? 'text-ink-3 font-medium' : sp?.type === 'holiday' ? 'text-accent' : 'text-ink-2'}
            ${k === today ? 'bg-ink text-surface' : ''} ${sp?.type === 'wanphra' ? 'shadow-[inset_0_0_0_2px_var(--color-amber)]' : ''}`}
        >
          {d.getDate()}
        </span>
        {sp?.type === 'holiday' && <span className="text-[9.5px] font-bold text-accent leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap">{sp.name}</span>}
        {show.map(e => (
          <span
            key={e.calendarId + e.id}
            onClick={ev => { ev.stopPropagation(); onOpenEvent(e) }}
            title={e.title}
            className={`flex items-center gap-1 text-[11.5px] leading-[1.5] py-0 px-1 rounded-[4px] bg-surface-2 border-[1.5px] border-line min-w-0 hover:bg-surface ${outOfMonth ? 'opacity-60' : ''}`}
          >
            <i className="w-1.5 h-1.5 rounded-full flex-none border border-line" style={{ background: e.color }} />
            {!e.allDay && <b className="font-mono font-bold tabular-nums flex-none text-ink-2">{hhmm(e.start)}</b>}
            <em className="not-italic overflow-hidden text-ellipsis whitespace-nowrap min-w-0">{e.title}</em>
          </span>
        ))}
        {list.length > show.length && <span className="text-[10.5px] text-ink-3 pl-1 font-semibold">+ อีก {list.length - show.length}</span>}
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-7 bg-surface-2 border-b-[3px] border-line">
        {DOW.map(d => <span key={d} className="py-[7px] px-2 text-[11px] font-bold text-ink-2 tracking-[0.03em] uppercase">{d}</span>)}
      </div>
      <div className="grid grid-cols-7">{cells}</div>
    </div>
  )
}
