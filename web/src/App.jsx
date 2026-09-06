import { useEffect, useState } from 'react'
import Tabs from './components/Tabs'
import Button from './components/Button'
import { DashboardProvider, useDashboard } from './state/DashboardContext'
import Overview from './tabs/Overview'
import Mail from './tabs/Mail'
import SlackTab from './tabs/Slack'
import DiscordTab from './tabs/Discord'
import GithubTab from './tabs/Github'
import CalendarTab from './tabs/Calendar'
import Connect from './tabs/Connect'

const TABS = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'mail', label: 'กล่องจดหมาย' },
  { id: 'cal', label: 'ปฏิทิน' },
  { id: 'slack', label: 'Slack' },
  { id: 'discord', label: 'Discord' },
  { id: 'github', label: 'GitHub' },
  { id: 'connect', label: 'เชื่อมต่ออื่น ๆ' },
]

function CatMark() {
  return (
    <span className="w-11 h-11 flex-none bg-surface grid place-items-center border-[3px] border-line rounded-lg shadow-[4px_4px_0_var(--color-accent)] -rotate-[4deg]" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="26" height="26">
        <path fill="#141110" d="M6 14 3 3l10 7z" />
        <path fill="#141110" d="M26 14 29 3l-10 7z" />
        <circle cx="16" cy="18" r="11" fill="#141110" />
        <circle cx="12" cy="17" r="1.4" fill="#ff441c" />
        <circle cx="20" cy="17" r="1.4" fill="#ff441c" />
        <path d="M15 21l1 1 1-1z" fill="#f2e9d8" />
      </svg>
    </span>
  )
}

function Header() {
  const { status, mail } = useDashboard()
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-[22px]">
      <div className="flex items-center gap-[15px]">
        <CatMark />
        <h1 className="text-[27px] font-extrabold m-0 tracking-[-0.01em] uppercase font-display">ภาพรวมงานของคุณ</h1>
      </div>
      <div className="flex items-center gap-2.5">
        {status?.loginEnabled && (
          <Button
            variant="ghost" size="sm"
            onClick={async () => { await fetch('/auth/site/logout', { method: 'POST' }).catch(() => {}); location.href = '/login' }}
          >
            ออกจากระบบ
          </Button>
        )}
        <div className="inline-flex items-center gap-1.5 bg-surface border-2 border-line rounded-full py-1.5 px-[13px] text-xs font-bold text-ink shadow-[3px_3px_0_var(--color-line)]">
          <span className={`w-2 h-2 rounded-full border-[1.5px] border-line ${mail?.inbox > 0 ? 'bg-amber' : 'bg-green'}`} />
          <StatusText />
        </div>
      </div>
    </div>
  )
}

function StatusText() {
  const { mail, mailGate } = useDashboard()
  if (mailGate) return <span>ยังไม่ได้เชื่อม Gmail</span>
  if (!mail) return <span>กำลังโหลด…</span>
  return <span>{mail.inbox > 0 ? `${mail.inbox} อีเมลรอดู` : 'Inbox สะอาด'}</span>
}

function Shell() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('mbx.tab') || 'overview' } catch { return 'overview' }
  })
  useEffect(() => {
    try { localStorage.setItem('mbx.tab', tab) } catch { /* private mode ปิด storage — ข้ามได้ ไม่กระทบการใช้งาน */ }
  }, [tab])

  return (
    <div className="max-w-[1080px] mx-auto px-5 pt-5 pb-14">
      <Header />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'overview' && <Overview goTab={setTab} />}
      {tab === 'mail' && <Mail />}
      {tab === 'cal' && <CalendarTab />}
      {tab === 'slack' && <SlackTab />}
      {tab === 'discord' && <DiscordTab />}
      {tab === 'github' && <GithubTab />}
      {tab === 'connect' && <Connect />}
    </div>
  )
}

export default function App() {
  return (
    <DashboardProvider>
      <Shell />
    </DashboardProvider>
  )
}
