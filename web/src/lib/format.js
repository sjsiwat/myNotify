export const PAL = ['#ff441c', '#2b31d8', '#0f8a4c', '#dd8f00', '#8b3fe8', '#e01e78', '#00a8ac', '#a85a00']

export const nfmt = n => (n ?? 0).toLocaleString('en-US')

export const deent = s => String(s ?? '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')

export function relTime(iso) {
  if (!iso) return ''
  const d = new Date(iso), diff = (new Date() - d) / 1000
  if (diff < 3600) return Math.max(1, Math.floor(diff / 60)) + ' นาที'
  if (diff < 86400) return Math.floor(diff / 3600) + ' ชม.'
  if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' วัน'
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export const initial = s => (String(s || '?').trim()[0] || '?').toUpperCase()

export const hue = s => PAL[Math.abs([...String(s || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0)) % PAL.length]
