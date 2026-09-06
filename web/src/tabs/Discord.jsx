import Card from '../components/Card'
import Kpi, { KpiGrid } from '../components/Kpi'
import GroupedFeed from '../components/GroupedFeed'
import ChannelChart from '../components/ChannelChart'
import { ErrorNote, Gate } from '../components/Misc'
import { useDashboard } from '../state/DashboardContext'
import { relTime, PAL } from '../lib/format'

export default function Discord() {
  const { discordFeed, discordError, discordGate } = useDashboard()

  if (discordError) return <ErrorNote>โหลด Discord ไม่สำเร็จ: {discordError}</ErrorNote>
  if (discordGate) return <Gate message={discordGate} />

  const chans = {}
  ;(discordFeed || []).forEach(x => { chans[x.chan] = (chans[x.chan] || 0) + 1 })
  const top = Object.entries(chans).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <KpiGrid>
        <Kpi label="ข้อความ 7 วัน" value={discordFeed ? discordFeed.length : null} highlight={discordFeed?.length > 0}
          note={discordFeed ? (discordFeed.length ? 'ล่าสุด ' + relTime(discordFeed[0].ts) + 'ที่แล้ว' : 'ไม่มี') : 'กำลังโหลด'} />
        <Kpi label="ห้องที่ติดตาม" value={discordFeed ? top.length : null} note="ตั้งไว้ใน .env" />
        <Kpi label="ห้องที่คึกคัก" value={discordFeed ? (top.length ? '#' + top[0][0] : '—') : null} note={top.length ? top[0][1] + ' ข้อความ' : '—'} />
      </KpiGrid>

      <Card title="ความเคลื่อนไหวในห้อง" hint="7 วันล่าสุด">
        <div className="p-4 pb-0">{discordFeed && <ChannelChart feed={discordFeed} height={230} />}</div>
        {discordFeed && (
          <GroupedFeed items={discordFeed} keyOf={x => x.chan} labelOf={k => '#' + k}
            colorOf={(_, i) => PAL[i % PAL.length]} limit={6} emptyMessage="ไม่มีความเคลื่อนไหวใน 7 วันที่ผ่านมา" />
        )}
        <div className="text-xs text-ink-2 py-2.5 px-4 bg-surface-2 border-t-[3px] border-line">
          เฉพาะห้องที่ตั้งไว้ใน <b>DISCORD_CHANNEL_IDS</b> — บอทอ่าน DM ส่วนตัวไม่ได้
        </div>
      </Card>
    </div>
  )
}
