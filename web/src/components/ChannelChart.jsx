import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import { PAL } from '../lib/format'

function chanData(list) {
  const c = {}
  ;(list || []).filter(x => !x.isDm).forEach(x => { c[x.chan] = (c[x.chan] || 0) + 1 })
  const keys = Object.keys(c).sort((a, b) => c[b] - c[a]).slice(0, 7)
  return { keys, vals: keys.map(k => c[k]) }
}

const OPTS = {
  responsive: true, maintainAspectRatio: false, indexAxis: 'y',
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.parsed.x + ' ข้อความ' } } },
  scales: {
    x: { grid: { color: '#d9c8a2' }, border: { display: false }, ticks: { color: '#7a6f5b', font: { family: 'JetBrains Mono', size: 10.5 }, precision: 0 } },
    y: { grid: { display: false }, border: { display: false }, ticks: { color: '#18130f', font: { size: 11, weight: '700' } } },
  },
}

export default function ChannelChart({ feed, height = 230 }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!feed) return
    const { keys, vals } = chanData(feed)
    if (!keys.length) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels: keys.map(k => '#' + k), datasets: [{ data: vals, backgroundColor: keys.map((_, i) => PAL[i % PAL.length]), borderRadius: 5, barPercentage: 0.7 }] },
      options: OPTS,
    })
    return () => chartRef.current?.destroy()
  }, [feed])

  const { keys } = chanData(feed || [])
  if (!keys.length) return null
  return <div style={{ height }}><canvas ref={canvasRef} /></div>
}
