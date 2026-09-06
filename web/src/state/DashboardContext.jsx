import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { src, needsAuth } from '../lib/api'
import { monthKey } from '../lib/calendar'

const DashboardContext = createContext(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider')
  return ctx
}

export function DashboardProvider({ children }) {
  const [status, setStatus] = useState(null)

  const [mail, setMail] = useState(null)
  const [mailGate, setMailGate] = useState(null) // authUrl หรือ null
  const [mailError, setMailError] = useState(null)

  const [inbox, setInbox] = useState(null)
  const [inboxError, setInboxError] = useState(null)

  const [slackDm, setSlackDm] = useState(null)
  const [slackFeed, setSlackFeed] = useState(null)
  const [slackError, setSlackError] = useState(null)
  const [slackGate, setSlackGate] = useState(null) // ข้อความ หรือ null

  const [calMonth, setCalMonth] = useState(monthKey(new Date()))
  const [calData, setCalData] = useState(null)
  const [calGate, setCalGateState] = useState(null) // { message, authUrl } หรือ null
  const [calError, setCalError] = useState(null)

  const [discordFeed, setDiscordFeed] = useState(null)
  const [discordError, setDiscordError] = useState(null)
  const [discordGate, setDiscordGate] = useState(null)

  const [github, setGithub] = useState(null)
  const [githubError, setGithubError] = useState(null)
  const [githubGate, setGithubGate] = useState(null)

  const loadMailbox = useCallback(async () => {
    try {
      const s = await src.summary()
      if (needsAuth(s)) return setMailGate(s.authUrl)
      setMailGate(null)
      setMail({ inbox: s.inbox, unread: s.unread, trash: s.trash, labels: s.labels || [] })
    } catch (e) { setMailError(e.message) }
  }, [])

  const loadInbox = useCallback(async () => {
    try {
      const th = await src.inbox()
      if (needsAuth(th)) return setMailGate(th.authUrl)
      setInbox(th)
    } catch (e) { setInboxError(e.message) }
  }, [])

  const loadSlack = useCallback(async () => {
    try {
      const { dms = [], feed = [] } = await src.slack()
      setSlackDm(dms); setSlackFeed(feed)
    } catch (e) { setSlackError(e.message) }
  }, [])

  const loadCalendar = useCallback(async (month) => {
    const m = month || calMonth
    try {
      const res = await src.calendar(m)
      if (needsAuth(res)) return setCalGateState({ message: 'ยังไม่ได้ให้สิทธิ์ปฏิทิน', authUrl: res.authUrl })
      setCalGateState(null)
      setCalMonth(m)
      setCalData(res)
    } catch (e) { setCalError(e.message) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calMonth])

  const loadDiscord = useCallback(async () => {
    try { setDiscordFeed(await src.discord()) } catch (e) { setDiscordError(e.message) }
  }, [])

  const loadGithub = useCallback(async () => {
    try { setGithub(await src.github()) } catch (e) { setGithubError(e.message) }
  }, [])

  useEffect(() => {
    (async () => {
      let s = { gmail: true, slack: true }
      try { s = await src.status() } catch { /* เก็บค่า default ไว้ ไม่ให้แอปพังทั้งหน้า */ }
      setStatus(s)

      if (s.gmail) { loadMailbox(); loadInbox() } else { setMailGate('/auth/google') }
      if (s.calendar) loadCalendar(monthKey(new Date()))
      else setCalGateState({
        message: s.gmail ? 'token เดิมยังไม่มีสิทธิ์ปฏิทิน — กดให้สิทธิ์อีกครั้ง (Gmail ไม่หลุด)' : 'ยังไม่ได้เชื่อมบัญชี Google',
        authUrl: '/auth/google',
      })
      if (s.slack) loadSlack()
      else setSlackGate('ยังไม่ได้ตั้ง SLACK_USER_TOKEN ใน .env')
      if (s.discord) loadDiscord()
      else setDiscordGate('ยังไม่ได้ตั้ง DISCORD_BOT_TOKEN / DISCORD_CHANNEL_IDS ใน .env')
      if (s.github) loadGithub()
      else setGithubGate('ยังไม่ได้ตั้ง GITHUB_TOKEN ใน .env')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = {
    status,
    mail, mailGate, mailError, loadMailbox,
    inbox, inboxError, loadInbox,
    slackDm, slackFeed, slackError, slackGate, loadSlack,
    calMonth, calData, calGate, calError, loadCalendar,
    discordFeed, discordError, discordGate, loadDiscord,
    github, githubError, githubGate, loadGithub,
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
