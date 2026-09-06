const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LEVEL_BG = ['var(--color-surface-2)', '#ffd4c2', '#ff9a6b', '#ff5e2b', '#c22e00']

/** ปฏิทิน contribution แบบ GitHub — คอลัมน์ละสัปดาห์ แถวละวัน (แถว 0 = อาทิตย์) */
export default function GithubCalendar({ weeks }) {
  const padFront = weeks[0]?.[0]?.weekday || 0
  const cells = []
  for (let i = 0; i < padFront; i++) cells.push(null)
  weeks.forEach(w => w.forEach(d => cells.push(d)))

  const months = []
  let lastMonth = -1, lastCol = -99
  weeks.forEach((w, i) => {
    const m = new Date(w[0].date).getMonth()
    if (m !== lastMonth && i - lastCol >= 3) { months.push({ col: i, label: MONTH_EN[m] }); lastCol = i }
    lastMonth = m
  })

  return (
    <div className="p-4 overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="ml-[30px] grid gap-x-[3px] text-[11px] text-ink-3 mb-1.5" style={{ gridTemplateColumns: `repeat(${weeks.length}, 11px)` }}>
          {months.map(m => <span key={m.col} style={{ gridColumn: m.col + 1 }} className="whitespace-nowrap">{m.label}</span>)}
        </div>
        <div className="flex gap-1.5">
          <div className="w-6 grid text-[10px] text-ink-3 leading-[11px]" style={{ gridTemplateRows: 'repeat(7, 11px)', rowGap: 3 }}>
            <span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span />
          </div>
          <div className="grid gap-[3px]" style={{ gridTemplateRows: 'repeat(7, 11px)', gridAutoFlow: 'column', gridAutoColumns: '11px' }}>
            {cells.map((d, i) => d
              ? (
                <i key={i} className="rounded-[2px] outline outline-1 -outline-offset-1 outline-line-soft"
                  style={{ background: LEVEL_BG[d.level] }}
                  title={`${d.count} contribution${d.count === 1 ? '' : 's'} · ${new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`} />
              )
              : <i key={i} />)}
          </div>
        </div>
        <div className="flex items-center gap-1 justify-end mt-2.5 text-[11px] text-ink-3">
          Less
          {LEVEL_BG.map((bg, i) => <i key={i} className="w-[11px] h-[11px] rounded-[2px] outline outline-1 -outline-offset-1 outline-line-soft" style={{ background: bg }} />)}
          More
        </div>
      </div>
    </div>
  )
}
