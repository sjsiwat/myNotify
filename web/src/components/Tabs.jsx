import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * แถบแท็บพร้อมแท่งไฮไลต์เลื่อนตามตำแหน่งจริงของปุ่ม (คำนวณจาก getBoundingClientRect
 * เพราะแต่ละปุ่มความกว้างไม่เท่ากัน ข้อความไทย/อังกฤษปนกัน)
 */
export default function Tabs({ tabs, active, onChange }) {
  const barRef = useRef(null)
  const indRef = useRef(null)
  const btnRefs = useRef({})
  const firstRun = useRef(true)

  const move = () => {
    const bar = barRef.current, ind = indRef.current, btn = btnRefs.current[active]
    if (!bar || !ind || !btn) return
    const barBox = bar.getBoundingClientRect(), btnBox = btn.getBoundingClientRect()
    ind.style.width = btnBox.width + 'px'
    ind.style.transform = `translateX(${btnBox.left - barBox.left}px)`
  }

  useLayoutEffect(() => {
    if (firstRun.current) {
      const ind = indRef.current
      if (ind) ind.style.transition = 'none'
      move()
      if (ind) requestAnimationFrame(() => { ind.style.transition = '' })
      firstRun.current = false
    } else {
      move()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <div ref={barRef} className="relative flex gap-1 bg-surface border-[3px] border-line rounded-[7px] shadow-[4px_4px_0_var(--color-line)] p-1.5 mb-[26px] overflow-x-auto">
      <span ref={indRef} className="absolute top-1.5 bottom-1.5 left-0 bg-ink rounded-[5px] transition-[transform,width] duration-[280ms] ease-[cubic-bezier(.34,1.4,.4,1)] z-0" />
      {tabs.map(t => (
        <button
          key={t.id}
          ref={el => { btnRefs.current[t.id] = el }}
          onClick={() => onChange(t.id)}
          className={`relative z-10 rounded-[5px] px-4 py-2.5 font-display text-[12.5px] font-bold uppercase tracking-[0.02em] whitespace-nowrap transition-colors ${active === t.id ? 'text-surface' : 'text-ink-2 hover:text-ink'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
