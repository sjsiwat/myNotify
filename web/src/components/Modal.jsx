import { useEffect } from 'react'

/** กรอบโมดัลกลาง — พื้นหลังมืด + การ์ดตรงกลาง ปิดได้ด้วย Escape หรือคลิกพื้นหลัง */
export default function Modal({ open, onClose, labelledBy, children, width = 520 }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 bg-[rgba(24,19,15,0.6)] grid place-items-center p-4 z-50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        className="bg-surface border-[3px] border-line rounded-[7px] w-full overflow-auto shadow-[8px_8px_0_var(--color-line)]"
        style={{ maxWidth: width, maxHeight: '88vh' }}
      >
        {children}
      </div>
    </div>
  )
}

export function ModalTitle({ id, children }) {
  return <h3 id={id} className="m-0 py-[15px] px-[18px] font-display text-[15px] font-bold uppercase tracking-[0.02em] border-b-[3px] border-line">{children}</h3>
}

export function ModalActions({ children }) {
  return <div className="flex gap-2 items-center py-[15px] px-[18px] mt-4 border-t-[3px] border-line">{children}</div>
}
