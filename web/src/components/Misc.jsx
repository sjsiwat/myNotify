import { relTime, initial, hue, deent } from '../lib/format'
import Button from './Button'

export function Empty({ children }) {
  return <div className="py-[30px] px-4 text-center text-ink-3 text-[13px] font-semibold">{children}</div>
}

export function Skeleton({ children = 'กำลังโหลด…' }) {
  return (
    <div className="py-6 px-4 text-ink-3 text-[13px] flex items-center gap-2.5">
      <span className="w-[13px] h-[13px] border-[2.5px] border-line-soft border-t-accent rounded-full animate-spin flex-none" />
      {children}
    </div>
  )
}

export function ErrorNote({ children }) {
  return <p className="m-0 py-[13px] px-4 bg-accent-soft border-2 border-line rounded-[6px] text-[#7a2400] text-[12.5px] font-bold">{children}</p>
}

export function Gate({ message, actionHref, actionLabel }) {
  return (
    <div className="py-[26px] px-4 text-center">
      <p className="m-0 mb-3.5 text-[13px] text-ink-2 font-semibold">{message}</p>
      {actionHref && <Button as="a" href={actionHref}>{actionLabel}</Button>}
    </div>
  )
}

export function FeedList({ items }) {
  return (
    <ul className="list-none m-0 p-0">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 py-2.5 px-4 border-b border-line-soft last:border-0 hover:bg-surface-2">
          <span className="w-[27px] h-[27px] rounded-[6px] flex-none grid place-items-center text-[11.5px] font-bold text-white border-2 border-line" style={{ background: hue(it.name || it.author) }}>
            {initial(it.name || it.author)}
          </span>
          <span className="flex-1 min-w-0">
            <b className="block text-[12.5px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{it.name || it.author}</b>
            <p className="m-0 mt-px text-[12.5px] text-ink-2 line-clamp-2">{deent(it.subject || it.text) || '(ไม่มีหัวข้อ)'}</p>
          </span>
          <span className="font-mono text-[11px] text-ink-3 whitespace-nowrap pt-px flex-none">{relTime(it.date || it.ts)}</span>
        </li>
      ))}
    </ul>
  )
}

export function Tag({ children, unread }) {
  return (
    <span className={`inline-block text-[10.5px] font-bold py-0.5 px-2 rounded-[4px] border-2 border-line whitespace-nowrap ${unread ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2'}`}>
      {children}
    </span>
  )
}

export function EvRow({ e, withDate }) {
  return (
    <div className="flex gap-3 py-3 px-4 border-b border-line-soft last:border-0 hover:bg-surface-2">
      <span className="w-[104px] flex-none font-mono text-[12px] font-bold text-ink-2">{evWhenLabel(e, withDate)}</span>
      <span className="flex-1 min-w-0">
        <b className="block text-[13.5px] font-bold">{e.title}</b>
        <span className="text-[12px] text-ink-3 mt-0.5 flex gap-1.5 flex-wrap items-center">
          <span className="w-[9px] h-[9px] rounded-full flex-none border border-line" style={{ background: e.color }} />
          {e.calendar}
          {e.location && <span>· {e.location}</span>}
        </span>
      </span>
    </div>
  )
}

function evWhenLabel(e, withDate) {
  const d = new Date(e.start)
  const dateLabel = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })
  if (e.allDay) return withDate ? dateLabel + ' · ทั้งวัน' : 'ทั้งวัน'
  const hhmm = iso => { const t = new Date(iso); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') }
  return withDate ? `${dateLabel} ${hhmm(e.start)}` : `${hhmm(e.start)} – ${hhmm(e.end)}`
}

export function CommitRow({ c }) {
  return (
    <div className={`flex gap-2.5 items-center py-2.5 px-4 border-b border-line-soft last:border-0 hover:bg-surface-2 ${c.mine ? '[&_.who]:text-accent [&_.who]:font-bold' : ''}`}>
      <span className="w-6 h-6 rounded-[6px] self-start mt-px border-2 border-line flex-none grid place-items-center text-[10px] font-bold text-white" style={{ background: hue(c.author) }}>
        {initial(c.author)}
      </span>
      <span className="w-[30%] max-w-[210px] flex-none min-w-0" title={c.repo}>
        <b className="block text-[12.5px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{c.repo}</b>
        <span className="who block text-[11.5px] text-ink-3 whitespace-nowrap overflow-hidden text-ellipsis">{c.author}{c.mine ? ' · คุณ' : ''}</span>
      </span>
      <span className="flex-1 min-w-0 text-[12.5px] text-ink-2 line-clamp-2">
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-inherit no-underline hover:underline">{c.msg}</a>
      </span>
      <span className="flex-none font-mono text-[11.5px] text-ink-3">{c.sha}</span>
      <span className="flex-none font-mono text-[11px] text-ink-3">{relTime(c.date)}</span>
    </div>
  )
}
