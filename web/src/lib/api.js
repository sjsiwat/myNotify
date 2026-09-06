async function api(path, opt) {
  const init = { headers: { accept: 'application/json' } }
  if (opt) {
    init.method = opt.method
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(opt.body || {})
  }
  const r = await fetch(path, init)
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(j?.error || `${path} → HTTP ${r.status}`)
  return j
}

/** ตอบกลับแบบ "ยังไม่ได้เชื่อม Gmail/Calendar" — backend คืน 200 พร้อม authUrl แทนที่จะ error */
export const needsAuth = r => Boolean(r && r.error && r.authUrl)

export const src = {
  status: () => api('/api/status'),
  summary: () => api('/api/mail/summary'),
  inbox: () => api('/api/mail/inbox'),
  mailGet: id => api('/api/mail/message/' + encodeURIComponent(id)),
  mailRead: ids => api('/api/mail/read', { method: 'POST', body: { ids } }),
  mailTrash: ids => api('/api/mail/trash', { method: 'POST', body: { ids } }),
  slack: () => api('/api/slack'),
  discord: () => api('/api/discord'),
  github: () => api('/api/github'),
  calendar: m => api('/api/calendar?month=' + encodeURIComponent(m)),
  calCreate: b => api('/api/calendar', { method: 'POST', body: b }),
  calUpdate: b => api('/api/calendar', { method: 'PATCH', body: b }),
  calDelete: b => api('/api/calendar', { method: 'DELETE', body: b }),
  lineDigest: () => api('/api/line/digest', { method: 'POST' }),
}
