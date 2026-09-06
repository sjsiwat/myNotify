import { useCountUp } from '../hooks/useCountUp'
import { nfmt } from '../lib/format'

export function KpiGrid({ children }) {
  return <div className="grid gap-3.5 mb-4.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))' }}>{children}</div>
}

export default function Kpi({ label, value, note, highlight, valueSize }) {
  const isNumber = typeof value === 'number'
  const display = useCountUp(isNumber ? value : null)
  const text = isNumber ? (display === null ? '–' : nfmt(display)) : (value ?? '–')
  return (
    <div
      className={`border-[3px] border-line rounded-[7px] px-4 py-[15px] shadow-[4px_4px_0_var(--color-line)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-line)] ${highlight ? 'bg-accent' : 'bg-surface'}`}
    >
      <div className={`text-[11px] uppercase tracking-[0.06em] font-bold ${highlight ? 'text-[#ffe9df]' : 'text-ink-2'}`}>{label}</div>
      <div className={`font-mono font-bold tracking-[-0.02em] mt-1.5 leading-[1.05] ${valueSize || 'text-[28px]'} ${highlight ? 'text-white' : 'text-ink'}`}>
        {text}
      </div>
      {note && <div className={`text-[11.5px] mt-1 font-medium ${highlight ? 'text-[#ffe9df]' : 'text-ink-3'}`}>{note}</div>}
    </div>
  )
}
