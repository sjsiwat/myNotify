import { useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { Skeleton } from '../components/Misc'
import { useDashboard } from '../state/DashboardContext'
import { src } from '../lib/api'

function Badge({ on }) {
  return (
    <span className={`text-[10.5px] font-bold py-[3px] px-2 rounded-[4px] border-2 border-line ${on ? 'bg-[#c8f2d4] text-[#0a5c33]' : 'bg-surface-2 text-ink-3'}`}>
      {on ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อม'}
    </span>
  )
}

function ConnCard({ title, on, desc, children }) {
  return (
    <div className="border-[3px] border-line rounded-[7px] p-[15px] bg-surface shadow-[4px_4px_0_var(--color-line)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--color-line)]">
      <h3 className="m-0 mb-1 font-display text-sm font-bold flex items-center gap-2 flex-wrap uppercase tracking-[0.01em]">
        {title} <Badge on={on} />
      </h3>
      <p className="m-0 text-[12.5px] text-ink-2">{desc}</p>
      {children}
    </div>
  )
}

function Hint({ children }) {
  return <p className="mt-2 mb-0 text-xs text-ink-3 leading-[1.5]">{children}</p>
}

export default function Connect() {
  const { status } = useDashboard()
  const [lineBusy, setLineBusy] = useState(false)
  const [lineSent, setLineSent] = useState(false)

  if (!status) return <Card title="แหล่งข้อมูล"><Skeleton /></Card>

  const logout = async () => {
    await fetch('/auth/google/logout', { method: 'POST' }).catch(() => {})
    location.reload()
  }

  const sendLineDigest = async () => {
    if (!confirm('ส่งสรุปวันนี้เข้า LINE ของคุณตอนนี้เลยไหม?')) return
    setLineBusy(true)
    try {
      await src.lineDigest()
      setLineSent(true)
      setTimeout(() => setLineSent(false), 2500)
    } catch (e) {
      alert('ส่งไม่สำเร็จ: ' + e.message)
    } finally {
      setLineBusy(false)
    }
  }

  return (
    <Card title="แหล่งข้อมูล" hint="โหมด standalone (backend ของตัวเอง)" bodyClassName="p-4">
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))' }}>
        <ConnCard title="Gmail" on={status.gmail} desc="อ่าน ทำเครื่องหมายอ่านแล้ว และลบอีเมลได้">
          {!status.gmail && <div className="mt-2.5"><Button as="a" href="/auth/google" size="sm">เชื่อม Gmail</Button></div>}
          {status.gmail && !status.gmailWrite && (
            <>
              <div className="mt-2.5"><Button as="a" href="/auth/google" size="sm">ให้สิทธิ์อ่านแล้ว/ลบอีเมล</Button></div>
              <Hint>token เดิมยังไม่มีสิทธิ์นี้ — กด Allow อีกครั้ง (การเชื่อมเดิมไม่หลุด)</Hint>
            </>
          )}
          {status.gmail && <div className="mt-2.5"><Button variant="ghost" size="sm" onClick={logout}>ยกเลิกการเชื่อม</Button></div>}
        </ConnCard>

        <ConnCard title="Google Calendar" on={status.calendar} desc="อ่าน เพิ่ม แก้ และลบนัดได้ — ใช้ OAuth เดียวกับ Gmail">
          {!status.calendar && (
            <>
              <div className="mt-2.5"><Button as="a" href="/auth/google" size="sm">{status.gmail ? 'ให้สิทธิ์ปฏิทิน' : 'เชื่อมบัญชี Google'}</Button></div>
              <Hint>{status.gmail ? 'token เดิมยังไม่มีสิทธิ์นี้ — กด Allow อีกครั้ง (Gmail ไม่หลุด)' : 'ปุ่มเดียวขอสิทธิ์ทั้งสองอย่างพร้อมกัน'}</Hint>
            </>
          )}
        </ConnCard>

        <ConnCard title="Slack" on={status.slack} desc="DM และช่องที่คุณอยู่">
          {!status.slack && <Hint>ตั้ง <b>SLACK_USER_TOKEN</b> ใน .env แล้วรีสตาร์ต server</Hint>}
        </ConnCard>

        <ConnCard title="GitHub" on={status.github} desc="Contribution calendar และคอมมิทล่าสุด">
          {!status.github && <Hint>ตั้ง <b>GITHUB_TOKEN</b> ใน .env แล้วรีสตาร์ต server</Hint>}
        </ConnCard>

        <ConnCard title="Discord" on={status.discord} desc="ข้อความในห้องที่ตั้งไว้ (อ่าน DM ไม่ได้)">
          {!status.discord && <Hint>ตั้ง <b>DISCORD_BOT_TOKEN</b> และ <b>DISCORD_CHANNEL_IDS</b> ใน .env — ดูวิธีสร้างบอทใน SETUP.md</Hint>}
        </ConnCard>

        <ConnCard title="LINE" on={status.line} desc="ส่งสรุปวันนี้ (อีเมล/นัด/Slack) เข้า LINE ของคุณเอง">
          {status.line && (
            <div className="mt-2.5">
              <Button size="sm" disabled={lineBusy} onClick={sendLineDigest}>
                {lineBusy ? 'กำลังส่ง…' : lineSent ? 'ส่งแล้ว ✓' : 'ส่งสรุปเข้า LINE ตอนนี้'}
              </Button>
            </div>
          )}
          {!status.line && <Hint>ตั้ง <b>LINE_CHANNEL_ACCESS_TOKEN</b> และ <b>LINE_USER_ID</b> ใน .env แล้วรีสตาร์ต server</Hint>}
        </ConnCard>
      </div>

      <ol className="mt-3 pl-[19px] text-[12.5px] text-ink-2 space-y-1">
        <li>คัดลอก <code>.env.example</code> เป็น <code>.env</code> แล้วเติมค่า — ดูขั้นตอนละเอียดใน <b>SETUP.md</b></li>
        <li>รีสตาร์ต server ด้วย <code>npm start</code></li>
        <li>กด "เชื่อม Gmail" ครั้งแรกเพื่อผ่านหน้า consent ของ Google</li>
      </ol>
    </Card>
  )
}
