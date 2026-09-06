import { useEffect, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { Empty, Skeleton, Gate, Tag } from '../components/Misc'
import Modal, { ModalTitle, ModalActions } from '../components/Modal'
import { useDashboard } from '../state/DashboardContext'
import { src } from '../lib/api'
import { nfmt, relTime, deent, PAL } from '../lib/format'

export default function Mail() {
  const { mail, mailGate, inbox, loadMailbox, loadInbox, status } = useDashboard()
  const [selected, setSelected] = useState(() => new Set())
  const [busy, setBusy] = useState(null)
  const [openId, setOpenId] = useState(null)

  const canWrite = Boolean(status?.gmailWrite)
  const canOpen = true // เปิดอ่านเนื้อหาใช้แค่สิทธิ์อ่าน ไม่ต้องรอ gmailWrite

  const refreshAll = async () => { await loadInbox(); loadMailbox().catch(() => {}) }

  const toggle = id => setSelected(s => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = checked => setSelected(checked ? new Set((inbox || []).map(m => m.id)) : new Set())

  const runAction = async (fn, label) => {
    if (!selected.size) return
    setBusy(label)
    try {
      await fn([...selected])
      setSelected(new Set())
      await refreshAll()
    } catch (e) {
      alert('ทำรายการไม่สำเร็จ: ' + e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <Card title="ค้างอยู่ใน Inbox" hint="อีเมลที่ยังไม่ถูกจัดเก็บ">
        {canWrite && inbox?.length > 0 && (
          <div className="flex items-center gap-3 py-2.5 px-4 border-b-[3px] border-line flex-wrap bg-surface-2">
            <label className="flex items-center gap-2 text-[13px] text-ink-2 font-semibold cursor-pointer">
              <input type="checkbox" className="w-4 h-4 accent-accent" checked={selected.size === inbox.length && inbox.length > 0}
                onChange={e => toggleAll(e.target.checked)} />
              เลือกทั้งหมด
            </label>
            <span className="text-[11.5px] text-ink-3 font-medium">{selected.size ? `เลือก ${selected.size} ฉบับ` : ''}</span>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" disabled={!selected.size || busy} onClick={() => runAction(src.mailRead, 'read')}>
                {busy === 'read' ? 'กำลังบันทึก…' : 'ทำเครื่องหมายว่าอ่านแล้ว'}
              </Button>
              <Button variant="danger" size="sm" disabled={!selected.size || busy} onClick={() => {
                if (!confirm(`ย้าย ${selected.size} ฉบับที่เลือกไปถังขยะ? (กู้คืนได้ใน Gmail)`)) return
                runAction(src.mailTrash, 'trash')
              }}>
                {busy === 'trash' ? 'กำลังลบ…' : 'ลบ'}
              </Button>
            </div>
          </div>
        )}
        {!canWrite && inbox?.length > 0 && (
          <div className="text-xs text-ink-2 py-2.5 px-4 bg-surface-2 border-t-[3px] border-line">
            ต้องให้สิทธิ์แก้ไขอีเมลก่อนถึงจะอ่านแล้ว/ลบได้ — ไปที่แท็บ <b>เชื่อมต่ออื่น ๆ</b> แล้วกด "ให้สิทธิ์อ่านแล้ว/ลบอีเมล"
          </div>
        )}

        {mailGate
          ? <Gate message="ยังไม่ได้เชื่อมบัญชี Gmail" actionHref={mailGate} actionLabel="เชื่อม Gmail" />
          : !inbox ? <Skeleton />
          : !inbox.length ? <Empty>Inbox ว่างสนิท — ไม่มีอะไรต้องดู</Empty>
          : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {canWrite && <th className="w-[34px] text-left text-[11px] uppercase tracking-[0.05em] font-bold py-2.5 px-4 border-b-[3px] border-line bg-surface-2" />}
                    <th className="text-left text-[11px] uppercase tracking-[0.05em] font-bold py-2.5 px-4 border-b-[3px] border-line bg-surface-2">จาก</th>
                    <th className="text-left text-[11px] uppercase tracking-[0.05em] font-bold py-2.5 px-4 border-b-[3px] border-line bg-surface-2">หัวข้อ</th>
                    <th className="text-left text-[11px] uppercase tracking-[0.05em] font-bold py-2.5 px-4 border-b-[3px] border-line bg-surface-2 w-[13%]" />
                    <th className="text-left text-[11px] uppercase tracking-[0.05em] font-bold py-2.5 px-4 border-b-[3px] border-line bg-surface-2 w-[14%]">เมื่อ</th>
                  </tr>
                </thead>
                <tbody>
                  {inbox.map((m, i) => (
                    <tr key={m.id}
                      className={`${canOpen ? 'cursor-pointer' : ''} ${i % 2 ? 'bg-[#f7f0e2]' : ''} border-b border-line-soft last:border-0 hover:bg-surface-2`}
                      onClick={() => canOpen && setOpenId(m.id)}
                    >
                      {canWrite && (
                        <td className="text-center align-top py-2.5 px-4" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="w-4 h-4 accent-accent align-middle" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                        </td>
                      )}
                      <td className="align-top py-2.5 px-4 w-[32%]">
                        <div className="font-bold text-[12.5px]">{m.name}</div>
                        <div className="font-mono text-ink-3 text-[11.5px] mt-0.5">{m.domain}</div>
                      </td>
                      <td className="align-top py-2.5 px-4">
                        <div className="text-ink-2 text-[12.5px] line-clamp-2">{deent(m.subject) || '(ไม่มีหัวข้อ)'}</div>
                      </td>
                      <td className="align-top py-2.5 px-4">
                        {m.isLinkedIn ? <Tag>LinkedIn</Tag> : m.unread ? <Tag unread>ใหม่</Tag> : null}
                      </td>
                      <td className="align-top py-2.5 px-4 font-mono text-ink-3 text-[11.5px] whitespace-nowrap">{relTime(m.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        <div className="text-xs text-ink-2 py-2.5 px-4 bg-surface-2 border-t-[3px] border-line">
          จัดกล่องอัตโนมัติทุกเช้า 8:00 น. — ที่ค้างคือรายการที่ตั้งใจเก็บไว้ให้ดู
        </div>
      </Card>

      <Card title="กล่องทั้งหมด" hint="นับเป็นเธรด" bodyClassName="p-4">
        <BoxesGrid mail={mail} mailGate={mailGate} />
      </Card>

      <MailModal id={openId} onClose={() => setOpenId(null)} canWrite={canWrite} onChanged={refreshAll} />
    </div>
  )
}

function BoxesGrid({ mail, mailGate }) {
  if (mailGate) return <Gate message="ยังไม่ได้เชื่อมบัญชี Gmail" actionHref={mailGate} actionLabel="เชื่อม Gmail" />
  if (!mail) return <Skeleton />
  const labels = mail.labels || []
  if (!labels.length) return <Empty>ยังไม่มีกล่องที่มีอีเมลอยู่</Empty>
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))' }}>
      {labels.map((l, i) => (
        <div key={l.name} className="flex items-center gap-2.5 py-2.5 px-3.5 border-2 border-line rounded-[7px] bg-surface shadow-[3px_3px_0_var(--color-line)] hover:bg-surface-2 hover:-translate-x-px hover:-translate-y-px transition-transform">
          <span className="w-[9px] h-[26px] rounded-sm flex-none border border-line" style={{ background: l.color || PAL[i % PAL.length] }} />
          <span className="flex-1 min-w-0">
            <b className="block text-[13px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{deent(l.name)}</b>
            <span className="text-[11.5px] text-ink-3">{nfmt(l.messages)} ฉบับ{l.unread > 0 ? ` · ${l.unread} ยังไม่อ่าน` : ''}</span>
          </span>
          <span className="font-mono text-[17px] font-bold tabular-nums">{nfmt(l.threads)}</span>
        </div>
      ))}
    </div>
  )
}

function MailModal({ id, onClose, canWrite, onChanged }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) { setData(null); setError(null); return }
    src.mailGet(id).then(setData).catch(e => setError(e.message))
    if (canWrite) src.mailRead([id]).then(onChanged).catch(() => {})
    // เปิดอ่านแล้วถือว่าอ่านแล้วเหมือน Gmail จริง — ทำเงียบ ๆ เบื้องหลัง ไม่ต้องรอ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const trash = async () => {
    if (!confirm('ย้ายอีเมลนี้ไปถังขยะ? (กู้คืนได้ใน Gmail)')) return
    try {
      await src.mailTrash([id])
      onClose()
      onChanged()
    } catch (e) {
      alert('ลบไม่สำเร็จ: ' + e.message)
    }
  }

  return (
    <Modal open={Boolean(id)} onClose={onClose} labelledBy="mailSubj">
      <ModalTitle id="mailSubj">{data ? (deent(data.subject) || '(ไม่มีหัวข้อ)') : 'กำลังโหลด…'}</ModalTitle>
      <div className="px-[18px] mt-[13px]">
        <div className="text-[12.5px] text-ink-3 leading-[1.6] font-semibold">
          {data ? `${data.from} · ${new Date(data.date).toLocaleString('th-TH')}` : ''}
        </div>
      </div>
      <div className="px-[18px] mt-[13px]">
        {error
          ? <p className="m-0 py-[13px] px-4 bg-accent-soft border-2 border-line rounded-[6px] text-[#7a2400] text-[12.5px] font-bold">โหลดเนื้อหาไม่สำเร็จ: {error}</p>
          : !data ? <Skeleton />
          : <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.65] text-ink max-h-[50vh] overflow-auto py-0.5">{data.body || '(ไม่มีเนื้อความ)'}</div>}
      </div>
      <ModalActions>
        <Button variant="danger" size="sm" onClick={trash}>ลบ</Button>
        <a className="ml-auto text-[13px] font-bold text-ink underline" href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(id || '')}`} target="_blank" rel="noopener noreferrer">
          เปิดใน Gmail ↗
        </a>
        <Button variant="ghost" size="sm" onClick={onClose}>ปิด</Button>
      </ModalActions>
    </Modal>
  )
}
