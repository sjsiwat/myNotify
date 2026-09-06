import Card from '../components/Card'
import Kpi, { KpiGrid } from '../components/Kpi'
import ChannelChart from '../components/ChannelChart'
import { Empty, Skeleton, FeedList, EvRow, CommitRow, Gate } from '../components/Misc'
import { useDashboard } from '../state/DashboardContext'
import { relTime } from '../lib/format'
import { upcoming } from '../lib/calendar'

export default function Overview({ goTab }) {
  const { mail, mailGate, slackDm, slackFeed, calData, calGate, github } = useDashboard()

  const todayCount = calData ? countToday(calData.events) : null
  const nextToday = calData ? nextEventToday(calData.events) : null

  return (
    <div>
      <KpiGrid>
        <Kpi label="Inbox ค้าง" value={mail ? mail.inbox : null} highlight={mail?.inbox > 0}
          note={mail ? (mail.inbox === 0 ? 'สะอาด' : 'รอคุณดู') : (mailGate ? 'ยังไม่ได้เชื่อม Gmail' : 'กำลังโหลด')} />
        <Kpi label="Slack ถึงคุณ" value={slackDm ? slackDm.length : null} highlight={slackDm?.length > 0}
          note={slackDm ? (slackDm.length ? 'ล่าสุด ' + relTime(slackDm[0].ts) + 'ที่แล้ว' : 'ไม่มี') : 'กำลังโหลด'} />
        <Kpi label="นัดวันนี้" value={todayCount} highlight={todayCount > 0}
          note={todayCount !== null ? (nextToday || 'ว่างทั้งวัน') : (calGate ? 'ยังไม่ได้ให้สิทธิ์ปฏิทิน' : 'กำลังโหลด')} />
        <Kpi label="ยังไม่ได้อ่าน" value={mail ? mail.unread : null} note={mail ? 'ทั้งบัญชี' : (mailGate ? 'ยังไม่ได้เชื่อม Gmail' : 'กำลังโหลด')} />
      </KpiGrid>

      <div className="grid gap-4 mb-4 items-start" style={{ gridTemplateColumns: '1.7fr 1fr' }}>
        <div className="flex flex-col gap-4">
          <Card title="ต้องดูในอีเมล" action={<MoreLink onClick={() => goTab('mail')} />}>
            <MailPreview />
          </Card>
          <Card title="คอมมิทล่าสุด" action={<MoreLink onClick={() => goTab('github')} />}>
            <GithubPreview github={github} />
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card title="Slack ถึงคุณ" action={<MoreLink onClick={() => goTab('slack')} />}>
            <SlackPreview slackDm={slackDm} />
          </Card>
          <Card title="นัดที่จะถึง" action={<MoreLink onClick={() => goTab('cal')} label="เปิดปฏิทิน →" />}>
            <CalPreview calData={calData} calGate={calGate} />
          </Card>
        </div>
      </div>

      <Card title="ช่อง Slack ที่คึกคัก" hint="7 วันล่าสุด">
        <div className="pt-3.5 px-4 pb-4">
          {slackFeed ? <ChannelChart feed={slackFeed} height={198} /> : <Skeleton />}
        </div>
      </Card>
    </div>
  )
}

function MoreLink({ onClick, label = 'ดูทั้งหมด →' }) {
  return (
    <button onClick={onClick} className="appearance-none bg-none border-0 font-inherit text-[11.5px] font-bold text-accent cursor-pointer p-0 uppercase tracking-[0.02em] hover:underline">
      {label}
    </button>
  )
}

function MailPreview() {
  const { inbox, mailGate } = useDashboard()
  if (mailGate) return <Gate message="ยังไม่ได้เชื่อมบัญชี Gmail" actionHref={mailGate} actionLabel="เชื่อม Gmail" />
  if (!inbox) return <Skeleton />
  if (!inbox.length) return <Empty>Inbox ว่างสนิท</Empty>
  return <FeedList items={inbox.slice(0, 4)} />
}

function SlackPreview({ slackDm }) {
  if (!slackDm) return <Skeleton />
  if (!slackDm.length) return <Empty>ไม่มีข้อความถึงคุณ</Empty>
  return <FeedList items={slackDm.slice(0, 4)} />
}

function GithubPreview({ github }) {
  if (!github) return <Skeleton />
  if (!github.commits?.length) return <Empty>ยังไม่มีคอมมิทใน repo ที่ push ล่าสุด</Empty>
  return <div>{github.commits.slice(0, 3).map(c => <CommitRow key={c.sha + c.repo} c={c} />)}</div>
}

function CalPreview({ calData, calGate }) {
  if (calGate) return <Gate message={calGate.message} actionHref={calGate.authUrl} actionLabel="ให้สิทธิ์ปฏิทิน" />
  if (!calData) return <Skeleton />
  const events = upcoming(calData.events, 4)
  if (!events.length) return <Empty>ไม่มีนัดข้างหน้าในเดือนนี้</Empty>
  return <div>{events.map(e => <EvRow key={e.calendarId + e.id} e={e} withDate />)}</div>
}

function countToday(events) {
  const today = new Date().toDateString()
  return (events || []).filter(e => new Date(e.allDay ? e.start : e.start).toDateString() === today).length
}

function nextEventToday(events) {
  const today = new Date().toDateString()
  const now = new Date()
  const list = (events || []).filter(e => !e.allDay && new Date(e.start).toDateString() === today)
  const next = list.find(e => new Date(e.end) >= now)
  if (next) {
    const t = new Date(next.start)
    return 'ถัดไป ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ' น.'
  }
  return list.length ? 'ผ่านไปหมดแล้ว' : ''
}
