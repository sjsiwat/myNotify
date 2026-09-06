import { useState } from 'react'
import { relTime, deent } from '../lib/format'
import { Empty } from './Misc'

/**
 * จัดข้อความเป็นกลุ่ม (ตามช่อง หรือตามคนส่ง) เรียงกลุ่มตามความคึกคัก
 * ในกลุ่มเรียงใหม่สุดก่อน โชว์ `limit` แรก ที่เหลือกางเพิ่มได้ด้วยปุ่ม "ดูอีก…"
 */
export default function GroupedFeed({ items, keyOf, labelOf, colorOf, limit = 6, emptyMessage }) {
  const [expanded, setExpanded] = useState(() => new Set())

  if (!items.length) return <Empty>{emptyMessage}</Empty>

  const by = new Map()
  items.forEach(x => {
    const k = keyOf(x)
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(x)
  })

  const groups = [...by.entries()]
    .map(([k, list]) => ({ k, items: [...list].sort((a, b) => new Date(b.ts) - new Date(a.ts)) }))
    .sort((a, b) => b.items.length - a.items.length || new Date(b.items[0].ts) - new Date(a.items[0].ts))

  return (
    <div>
      {groups.map((g, gi) => {
        const isOpen = expanded.has(g.k)
        const rows = isOpen ? g.items : g.items.slice(0, limit)
        const rest = g.items.length - limit
        return (
          <div key={g.k} className="border-b-[3px] border-line last:border-0">
            <div className="flex items-center gap-2 py-2.5 px-4 bg-surface-2 border-b border-line-soft">
              <span className="w-[9px] h-[9px] rounded-full flex-none border-[1.5px] border-line" style={{ background: colorOf(g.k, gi) }} />
              <b className="text-[12.5px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{labelOf(g.k)}</b>
              <span className="font-mono text-[11px] font-bold bg-surface border-2 border-line rounded-full py-0 px-[7px] flex-none tabular-nums">{g.items.length}</span>
              <span className="ml-auto text-[11.5px] text-ink-3 whitespace-nowrap flex-none">ล่าสุด {relTime(g.items[0].ts)}ที่แล้ว</span>
            </div>
            {rows.map((x, i) => (
              <div key={i} className="flex gap-3 items-baseline py-2.5 px-4 border-b border-line-soft last:border-0 text-[12.5px]">
                <span className="w-[32%] max-w-[200px] flex-none font-bold whitespace-nowrap overflow-hidden text-ellipsis">{x.author}</span>
                <span className="flex-1 min-w-0 text-ink-2 line-clamp-2">{deent(x.text)}</span>
                <span className="flex-none font-mono text-ink-3 text-[11px] tabular-nums">{relTime(x.ts)}</span>
              </div>
            ))}
            {!isOpen && rest > 0 && (
              <button
                onClick={() => setExpanded(s => new Set(s).add(g.k))}
                className="block w-full appearance-none bg-none border-0 border-t border-line-soft py-2 px-4 text-[11.5px] font-bold text-accent cursor-pointer text-left uppercase tracking-[0.02em] hover:bg-surface-2"
              >
                ดูอีก {rest} ข้อความ
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
