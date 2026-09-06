import Card from '../components/Card'
import Kpi, { KpiGrid } from '../components/Kpi'
import GroupedFeed from '../components/GroupedFeed'
import ChannelChart from '../components/ChannelChart'
import { Skeleton, ErrorNote, Gate } from '../components/Misc'
import { useDashboard } from '../state/DashboardContext'
import { relTime, hue, PAL } from '../lib/format'

export default function Slack() {
  const { slackDm, slackFeed, slackError, slackGate } = useDashboard()

  if (slackError) return <ErrorNote>โหลด Slack ไม่สำเร็จ: {slackError}</ErrorNote>
  if (slackGate) return <Gate message={slackGate} />

  const chans = {}
  ;(slackFeed || []).forEach(x => { if (!x.isDm) chans[x.chan] = (chans[x.chan] || 0) + 1 })
  const top = Object.entries(chans).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <KpiGrid>
        <Kpi label="ถึงคุณโดยตรง" value={slackDm ? slackDm.length : null} highlight={slackDm?.length > 0}
          note={slackDm ? (slackDm.length ? 'ล่าสุด ' + relTime(slackDm[0].ts) + 'ที่แล้ว' : 'ไม่มี') : 'กำลังโหลด'} />
        <Kpi label="ความเคลื่อนไหว 7 วัน" value={slackFeed ? slackFeed.length : null} note="ในช่องที่คุณอยู่" />
        <Kpi label="ช่องที่คึกคัก" value={slackFeed ? top.length : null} note={top.length ? '#' + top[0][0] + ' มากสุด' : '—'} />
      </KpiGrid>

      <Card title="ข้อความถึงคุณ" hint="DM และข้อความที่ระบุถึงคุณ">
        {!slackDm ? <Skeleton /> : (
          <GroupedFeed items={slackDm} keyOf={x => x.author} labelOf={k => k} colorOf={k => hue(k)} limit={4} emptyMessage="ไม่มีข้อความถึงคุณ" />
        )}
      </Card>

      <Card title="ความเคลื่อนไหวในช่อง" hint="7 วันล่าสุด">
        <div className="p-4 pb-0">{slackFeed && <ChannelChart feed={slackFeed} height={230} />}</div>
        {!slackFeed ? <Skeleton /> : (
          <GroupedFeed items={slackFeed.filter(x => !x.isDm)} keyOf={x => x.chan} labelOf={k => '#' + k}
            colorOf={(_, i) => PAL[i % PAL.length]} limit={6} emptyMessage="ไม่มีความเคลื่อนไหวใน 7 วันที่ผ่านมา" />
        )}
      </Card>
    </div>
  )
}
