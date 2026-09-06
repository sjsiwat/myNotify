import { useEffect, useRef, useState } from 'react'

/**
 * นับตัวเลขไต่ขึ้นจากค่าก่อนหน้าไปค่าใหม่ทุกครั้งที่ target เปลี่ยน
 * ค่าที่ไม่ใช่ตัวเลข (เช่น null ตอนกำลังโหลด) ให้ปล่อยผ่าน แสดง "–" แทน
 */
export function useCountUp(target, duration = 550) {
  const [display, setDisplay] = useState(typeof target === 'number' ? target : 0)
  const prevRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    if (typeof target !== 'number') return
    if (prevRef.current === target) return
    const from = prevRef.current ?? 0
    prevRef.current = target
    const start = performance.now()

    cancelAnimationFrame(frameRef.current)
    function tick(now) {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (target - from) * eased))
      if (p < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return typeof target === 'number' ? display : null
}
