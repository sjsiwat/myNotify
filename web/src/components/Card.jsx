export default function Card({ title, hint, action, children, className = '', bodyClassName = '' }) {
  return (
    <div className={`bg-surface border-[3px] border-line rounded-[7px] shadow-[5px_5px_0_var(--color-line)] overflow-hidden ${className}`}>
      {(title || action) && (
        <h2 className="font-display text-[13.5px] font-bold m-0 px-4 py-[13px] border-b-[3px] border-line uppercase tracking-[0.02em] flex items-center justify-between gap-2.5">
          <span className="flex items-center gap-2.5">
            {title}
            {hint && <span className="text-[11.5px] text-ink-3 font-medium normal-case tracking-normal">{hint}</span>}
          </span>
          {action}
        </h2>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  )
}
