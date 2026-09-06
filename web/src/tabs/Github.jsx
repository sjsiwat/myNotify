import Card from '../components/Card'
import GithubCalendar from '../components/GithubCalendar'
import { CommitRow, Empty, Skeleton, ErrorNote, Gate } from '../components/Misc'
import { useDashboard } from '../state/DashboardContext'
import { nfmt } from '../lib/format'

export default function Github() {
  const { github, githubError, githubGate } = useDashboard()

  if (githubError) return <ErrorNote>โหลด GitHub ไม่สำเร็จ: {githubError}</ErrorNote>
  if (githubGate) return <Gate message={githubGate} />

  return (
    <div>
      <Card title={github ? `${nfmt(github.total)} contributions in the last year` : 'Contribution activity'} hint={github ? '@' + github.login : ''}>
        {!github ? <Skeleton /> : github.weeks?.length ? <GithubCalendar weeks={github.weeks} /> : <Empty>ไม่มีข้อมูล contribution</Empty>}
      </Card>
      <Card title="คอมมิทล่าสุด" hint="จาก repo ที่ push ล่าสุด">
        {!github ? <Skeleton /> : !github.commits.length ? <Empty>ยังไม่มีคอมมิทใน repo ที่ push ล่าสุด</Empty>
          : <div>{github.commits.map(c => <CommitRow key={c.sha + c.repo} c={c} />)}</div>}
      </Card>
    </div>
  )
}
