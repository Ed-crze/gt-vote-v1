'use client'
import React, { useEffect, useState, useRef } from 'react'
import { Bell, User, Send, Award, BarChart2, CheckSquare, Users, Search, LogOut, ChevronDown, X, ClipboardCheck, Clock } from 'lucide-react'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth-client'
import { clearSessionActivity } from '@/lib/useInactivityTimeout'
import PageBackground from '@/components/PageBackground'

export default function DashboardPage() {
  const { navigateTo, fadingOut } = useNavigate()

  const [user, setUser] = useState<{
    id: string
    name: string
    faculty: string
    voted: boolean
  } | null>(null)

  const [leaderboard, setLeaderboard] = useState<{
    name: string
    pct: number
    total: number
    rank: number
  }[]>([])

  const [totalRegistered, setTotalRegistered] = useState(0)
  const [turnoutPct, setTurnoutPct] = useState(0)
  const [countdown, setCountdown] = useState('14:00:00')
  const [urgent, setUrgent] = useState(false)
  const [showAnnouncement, setShowAnnouncement] = useState(true)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [notifRead, setNotifRead] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifAccordion, setNotifAccordion] = useState(false)
  const [barWidths, setBarWidths] = useState<number[]>([])
  const [leaderboardReady, setLeaderboardReady] = useState(false)
  const [turnoutOffset, setTurnoutOffset] = useState(163.36)
  const endRef = useRef(Date.now() + 14 * 3600 * 1000)
  const notifRef = useRef<HTMLDivElement>(null)
  const [votingOpen, setVotingOpen] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [showProfiles, setShowProfiles] = useState(true)
  const [notifState, setNotifState] = useState<'none' | 'opened' | 'closing' | 'closed'>('none')
  const [notifDismissed, setNotifDismissed] = useState(false)

  // Live mirrors of state the countdown tick needs — the tick's setInterval
  // closure is created once ([] deps) and would otherwise read stale values.
  const votedRef = useRef(false)
  const votingOpenRef = useRef(true)
  const notifStateRef = useRef<'none' | 'opened' | 'closing' | 'closed'>('none')
  const openedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { votedRef.current = user?.voted ?? false }, [user])
  useEffect(() => { votingOpenRef.current = votingOpen }, [votingOpen])
  useEffect(() => { notifStateRef.current = notifState }, [notifState])

  // Auto-dismiss the "voting opened" banner after 8s and remember for the session
  useEffect(() => {
    if (notifState === 'opened') {
      openedTimeoutRef.current = setTimeout(() => {
        setNotifDismissed(true)
        sessionStorage.setItem('gt_voting_opened_shown', 'true')
      }, 8000)
      return () => { if (openedTimeoutRef.current) clearTimeout(openedTimeoutRef.current) }
    }
  }, [notifState])

  useEffect(() => {
    const supabase = createClient()

    // Clears the session even when Supabase's own signOut() hangs on a
    // corrupt token: races it against a timeout, then nukes the auth keys
    // out of localStorage directly so the next load starts clean.
    async function hardSignOut() {
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise(res => setTimeout(res, 2000)),
        ])
      } catch {}
      try {
        Object.keys(window.localStorage).forEach(k => {
          if (k.startsWith('sb-')) window.localStorage.removeItem(k)
        })
      } catch {}
    }

    async function loadUser() {
      try {
        // getUser() can hang forever in Chrome when the stored auth token is
        // corrupt (the Web Locks API deadlocks). Race it against a timeout so
        // a hung call can never freeze the page on the loading screen.
        const authResult = await Promise.race([
          supabase.auth.getUser(),
          new Promise<'timeout'>(res => setTimeout(() => res('timeout'), 6000)),
        ])

        if (authResult === 'timeout' || authResult.error || !authResult.data?.user) {
          await hardSignOut()
          navigateTo('/login')
          return
        }
        const authUser = authResult.data.user

        const { data: profile } = await supabase
          .from('students')
          .select('full_name, faculty, student_id')
          .eq('id', authUser.id)
          .single()

        if (!profile) {
          await hardSignOut()
          navigateTo('/login')
          return
        }

        // ── Check voted status via secure function ──────────────────────
        // voter_registry is no longer directly readable after the corrective
        // migration (§9 RLS fix). has_current_user_voted() is a security
        // definer function that derives the hash server-side from auth.uid()
        // and never exposes the registry to the client.
        const { data: votedStatus } = await supabase
          .rpc('has_current_user_voted')

        const hasVoted = votedStatus ?? false

        setUser({
          id: authUser.id,
          name: profile.full_name,
          faculty: profile.faculty,
          voted: hasVoted,
        })

        // ── Load election settings ──────────────────────────────────────
        const { data: settings } = await supabase
          .from('election_settings')
          .select('is_open, announcement, start_time, end_time, show_results, show_profiles')
          .eq('id', 1)
          .single()

        if (settings) {
          if (settings.announcement) setAnnouncement(settings.announcement)
          setShowResults(settings.show_results ?? false)
          setShowProfiles(settings.show_profiles ?? true)

          if (settings.end_time) {
            endRef.current = new Date(settings.end_time).getTime()
            const timeExpired = new Date(settings.end_time).getTime() < Date.now()
            // Open only if admin enabled it AND time hasn't expired
            setVotingOpen((settings.is_open ?? false) && !timeExpired)
            if (timeExpired) setCountdown('Closed')
          } else {
            setVotingOpen(settings.is_open ?? false)
          }
        }

        // ── Load turnout via secure aggregate functions ─────────────────
        // voter_registry and students are no longer directly readable after
        // the corrective migration (§8 and §9). get_overall_turnout() and
        // get_faculty_turnout() are security definer functions that return
        // only aggregates — no individual ballot or identity data is exposed.
        const [{ data: turnout }, { data: facultyTurnout }] = await Promise.all([
          supabase.rpc('get_overall_turnout'),
          supabase.rpc('get_faculty_turnout'),
        ])

        if (turnout?.[0]) {
          const totalReg = Number(turnout[0].registered)
          const pct = Number(turnout[0].turnout_pct)

          setTotalRegistered(totalReg)
          setTurnoutPct(pct)

          setTimeout(() => {
            const circumference = 163.36
            setTurnoutOffset(circumference - (pct / 100) * circumference)
          }, 400)
        }

        // get_faculty_turnout() returns real per-faculty turnout and suppresses
        // any faculty with fewer than 10 registrations — so zero rows is a
        // legitimate answer, not a pending one. Rank by actual turnout, with
        // registration count breaking ties.
        const ranked = (facultyTurnout ?? [])
          .map((f: any) => ({
            name: String(f.faculty).replace('Faculty of ', ''),
            pct: Number(f.turnout_pct),
            total: Number(f.registered),
          }))
          .sort((a: any, b: any) => b.pct - a.pct || b.total - a.total)
          .map((f: any, i: number) => ({ ...f, rank: i + 1 }))

        setLeaderboard(ranked)
        setLeaderboardReady(true)

        setTimeout(() => setBarWidths(ranked.map((f: any) => f.pct)), 400)

        const params = new URLSearchParams(window.location.search)
        if (params.get('voted') === 'true') launchConfetti()
      } catch (err) {
        // Any unexpected failure (network, bad session, etc.) — never get
        // stuck on the loading screen; clear the session and go to login.
        console.error('Dashboard load failed:', err)
        await hardSignOut()
        navigateTo('/login')
      }
    }

    loadUser()

    // Countdown timer — reads from endRef which is now set from database
    const tick = setInterval(() => {
      const diff = endRef.current - Date.now()
      if (diff <= 0) {
        setCountdown('Closed')
        setUrgent(false)
        setVotingOpen(false)
        // STATE 3 — voting closed; only non-voters get the banner
        if (!votedRef.current) setNotifState('closed')
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      setUrgent(diff < 2 * 3600 * 1000)

      // ── In-app banner state machine (reads live values via refs) ──
      if (votingOpenRef.current) {
        if (diff <= 3600000 && !votedRef.current) {
          // STATE 2 — closing soon, non-voter (urgent, cannot dismiss)
          if (notifStateRef.current !== 'closing') setNotifState('closing')
        } else if (diff > 3600000 && notifStateRef.current === 'none') {
          // STATE 1 — voting just opened (once per session)
          if (sessionStorage.getItem('gt_voting_opened_shown') !== 'true') {
            setNotifState('opened')
          }
        }
      }
    }, 1000)

    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => {
      clearInterval(tick)
      document.removeEventListener('click', handleClick)
    }
  }, [])

  const doLogout = async () => {
    clearSessionActivity()
    await signOut()
    navigateTo('/home')
  }

  const launchConfetti = () => {
    const colors = ['#C9A227', '#1B2A5E', '#fff', '#22C55E', '#f0d060']
    for (let i = 0; i < 60; i++) {
      setTimeout(() => {
        const el = document.createElement('div')
        el.style.cssText = `position:fixed;width:8px;height:8px;border-radius:2px;z-index:999;pointer-events:none;left:${Math.random() * 100}vw;top:-20px;background:${colors[Math.floor(Math.random() * colors.length)]};animation:dashConfettiFall ${1.5 + Math.random() * 2}s linear forwards;`
        document.body.appendChild(el)
        setTimeout(() => el.remove(), 4000)
      }, i * 40)
    }
  }

  if (!user) return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1628 50%, #0a0f1e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
    }}>
      <span className="spin" style={{
        display: 'inline-block', width: '36px', height: '36px',
        border: '3px solid rgba(201,162,39,0.2)',
        borderTopColor: '#C9A227', borderRadius: '50%',
      }} />
      <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
        Loading your dashboard...
      </div>
    </div>
  )

  const navName = user.name.split(' ').slice(0, 2).join(' ')
  const faculty = user.faculty?.replace('Faculty of ', '') ?? 'Information Technology'
  const deadlineStr = new Date(endRef.current).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  const NOTIFS = [
    { icon: <Send size={13} color="#C9A227" />, text: <><strong>Voting is now open!</strong> Cast your vote before the deadline.</>, time: 'Today' },
    { icon: <Award size={13} color="#C9A227" />, text: <><strong>Faculty Leaderboard</strong> is live. Check your faculty ranking below.</>, time: 'Today' },
    { icon: <BarChart2 size={13} color="#C9A227" />, text: <>Results will be announced after polls close.</>, time: 'Today' },
  ]

  return (
    <>
      {/* Mobile overlay and menu */}
      <div className={`dash-mobile-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
      <div className={`dash-mobile-menu ${menuOpen ? 'open' : ''}`}>
        <button className="dash-menu-close" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        <div className="dash-menu-name">{user.name}</div>
        <div className="dash-menu-faculty">Faculty of {faculty}</div>
        <div className="dash-menu-divider" />
        <div className="dash-menu-notif-toggle" onClick={() => setNotifAccordion(v => !v)}>
          <div className="dash-menu-notif-label">
            <Bell size={15} /> Notifications
            {!notifRead && <span className="dash-menu-notif-dot" />}
          </div>
          <ChevronDown size={14} color="rgba(255,255,255,0.4)" style={{ transition: 'transform 0.3s ease', transform: notifAccordion ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </div>
        <div className="dash-menu-notif-accordion" style={{ maxHeight: notifAccordion ? '400px' : '0px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <span onClick={() => setNotifRead(true)} style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontWeight: 600 }}>Mark all read</span>
          </div>
          {NOTIFS.map((n, i) => (
            <div key={i} className="dash-menu-notif-item">
              <span style={{ flexShrink: 0, marginTop: 2 }}>{n.icon}</span>
              <div>
                <div className="dash-menu-notif-text">{n.text}</div>
                <div className="dash-menu-notif-time">{n.time}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="dash-menu-divider" />
        <button className="dash-menu-signout" onClick={doLogout}><LogOut size={15} /> Sign Out</button>
      </div>

      <PageBackground fadingOut={fadingOut}>
        <div className="dash-page">

          {/* TOP NAV */}
          <nav className="dash-topnav">
            <div className="dash-nav-left">
              <img src="/gctu-crest.png" alt="GCTU" className="dash-nav-crest" loading="eager" />
              <div className="dash-nav-title">GT<span>-Vote</span></div>
            </div>
            <div className="dash-nav-right">
              <div className="dash-notif-wrap" ref={notifRef} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setShowNotif(v => !v) }}>
                <Bell size={18} color="#fff" />
                {!notifRead && <span className="dash-notif-dot" />}
              </div>
              <div className="dash-nav-name">{navName}</div>
              <button className="dash-logout-btn" onClick={doLogout}>Sign Out</button>
            </div>
            <button className="dash-hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <span /><span /><span />
            </button>
          </nav>

          {/* NOTIF DROPDOWN */}
          <div className={`dash-notif-dd ${showNotif ? 'open' : ''}`} style={{ position: 'fixed', top: '60px', right: '1.5rem' }}>
            <div className="dash-notif-header">
              Notifications
              <span className="dash-notif-clear" onClick={() => { setNotifRead(true); setShowNotif(false) }}>Mark all read</span>
            </div>
            {NOTIFS.map((n, i) => (
              <div key={i} className="dash-notif-item">
                <span className="dash-notif-icon">{n.icon}</span>
                <div>
                  <div className="dash-notif-text">{n.text}</div>
                  <div className="dash-notif-time">{n.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ANNOUNCEMENT */}
          {showAnnouncement && (
            <div className="dash-announcement">
              <div className="dash-announcement-text">
                <Send size={16} color="#C9A227" style={{ flexShrink: 0 }} />
                <span>
                  {announcement
                    ? announcement
                    : <><strong>Reminder:</strong> Voting closes today at <strong>5:00 PM</strong>. Results announced live at <strong>6:00 PM</strong> — Main Hall.</>
                  }
                </span>
              </div>
              <button className="dash-dismiss-btn" onClick={() => setShowAnnouncement(false)}>
                <X size={12} />
              </button>
            </div>
          )}

          {/* CONTENT */}
          <div className="dash-content">

            {/* ── Automatic in-app status banner (separate from admin announcement) ── */}
            {notifState === 'opened' && !notifDismissed && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(34,197,94,0.15)', border: '1px solid #22C55E',
                borderRadius: '10px', padding: '11px 1.5rem', marginBottom: '1rem',
              }}>
                <CheckSquare size={18} color="#22C55E" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.45 }}>
                  🗳️ Voting is now open! Cast your ballot before <strong style={{ color: '#22C55E' }}>{deadlineStr}</strong>. Your vote is anonymous and secure.
                </span>
                <button
                  onClick={() => { setNotifDismissed(true); sessionStorage.setItem('gt_voting_opened_shown', 'true') }}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: 0 }}
                  aria-label="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {notifState === 'closing' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(201,162,39,0.15)', border: '1px solid #C9A227',
                borderRadius: '10px', padding: '11px 1.5rem', marginBottom: '1rem',
              }}>
                <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                  <Clock size={18} color="#C9A227" />
                  <span style={{
                    position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px',
                    borderRadius: '50%', background: '#C9A227', animation: 'dashUrgentPulse 1.5s infinite',
                  }} />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.45 }}>
                  ⏰ Voting closes in <strong style={{ color: '#C9A227' }}>{countdown}</strong>. You haven&apos;t voted yet — cast your ballot now before it&apos;s too late!
                </span>
                <button
                  onClick={() => setShowPopup(true)}
                  style={{
                    flexShrink: 0, background: '#C9A227', border: 'none', borderRadius: '8px',
                    padding: '8px 14px', fontFamily: 'Inter, sans-serif', fontSize: '0.76rem',
                    fontWeight: 800, color: '#1B2A5E', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Vote Now →
                </button>
              </div>
            )}

            {notifState === 'closed' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(239,68,68,0.15)', border: '1px solid #EF4444',
                borderRadius: '10px', padding: '11px 1.5rem', marginBottom: '1rem',
              }}>
                <X size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.45 }}>
                  🔒 Voting has now closed. The deadline has passed and no further ballots are being accepted.
                </span>
              </div>
            )}

            {/* Welcome card */}
            <div className="dash-welcome-card">
              <div>
                <div className="dash-welcome-greeting">Welcome back <User size={16} color="#C9A227" /></div>
                <div className="dash-welcome-name">{user.name}</div>
                <div className="dash-welcome-faculty">Faculty of <span>{faculty}</span></div>
              </div>
              <div className="dash-vote-status">
                <div className={`dash-status-badge ${user.voted ? 'voted' : 'not-voted'}`}>
                  {user.voted ? 'Voted' : 'Not Voted'}
                </div>
                <div className="dash-status-label">Your Status</div>
              </div>
            </div>

            {/* Stats row — three separate cards */}
            <div className="dash-stats-row">
              <div className="dash-stat-card">
                <div className="dash-stat-val">
                  {totalRegistered > 0 ? totalRegistered.toLocaleString() : '—'}
                </div>
                <div className="dash-stat-lbl">Registered</div>
              </div>

              <div className="dash-stat-card">
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#C9A227" strokeWidth="5"
                    strokeDasharray="163.36" strokeDashoffset={turnoutOffset}
                    strokeLinecap="round" transform="rotate(-90 32 32)"
                    style={{ transition: 'stroke-dashoffset 1.4s ease' }} />
                  <text x="32" y="36" textAnchor="middle" fill="#C9A227" fontSize="12" fontWeight="900" fontFamily="Inter">
                    {turnoutPct}%
                  </text>
                </svg>
                <div className="dash-stat-lbl">Turnout</div>
              </div>

              <div className="dash-stat-card">
                <div className={`dash-stat-val ${urgent ? 'urgent' : ''}`}>{countdown}</div>
                <div className="dash-stat-lbl">Time Left</div>
              </div>
            </div>

            {/* Results Are In — shown only when voting has closed and admin published results */}
            {!votingOpen && showResults && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(201,162,39,0.16), rgba(27,42,94,0.35))',
                border: '1px solid rgba(201,162,39,0.45)',
                borderRadius: '16px',
                padding: '1.1rem 1.25rem',
                margin: '0 0 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>
                    🏁 Results Are In
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                    Voting has ended. View the final results below.
                  </div>
                </div>
                <button
                  onClick={() => navigateTo('/results')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%', padding: '13px',
                    background: '#C9A227', border: 'none', borderRadius: '11px',
                    fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 900,
                    color: '#1B2A5E', cursor: 'pointer', letterSpacing: '0.03em',
                    transition: 'all 0.2s',
                  }}
                >
                  View Final Results →
                </button>
              </div>
            )}

            {/* Vote button */}
            <div className="dash-vote-wrap">
              {user.voted ? (
                <button className="dash-voted-btn">
                  <CheckSquare size={16} />Already Voted
                </button>
              ) : !votingOpen ? (
                <button className="dash-voted-btn" style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'not-allowed' }}>
                  <X size={16} />Voting is Closed
                </button>
              ) : (
                <button className="dash-vote-btn" onClick={() => setShowPopup(true)}>
                  <CheckSquare size={16} />Cast Your Vote
                </button>
              )}
            </div>

            {/* Meet the Candidates — hidden when admin disables candidate profiles */}
            {showProfiles && (
              <div className="dash-ghost-wrap">
                <button className="dash-ghost-btn" onClick={() => navigateTo('/candidates')}>
                  <Users size={16} />Meet the Candidates
                </button>
              </div>
            )}

            {/* Verify My Vote */}
            <div className="dash-ghost-wrap">
              <button
                className={`dash-ghost-btn ${!user.voted ? 'disabled' : ''}`}
                onClick={() => { if (user.voted) navigateTo('/verify') }}
              >
                <Search size={16} />Verify My Vote
              </button>
              <div className={`dash-verify-hint ${user.voted ? 'active' : ''}`}>
                {user.voted ? 'Check that your ballot was counted' : 'Vote first to verify your ballot'}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="dash-lb-wrap">
              <div className="dash-section-title">Faculty Leaderboard</div>
              <div className="dash-lb-card">
                {!leaderboardReady ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    Loading leaderboard...
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 1.25rem', color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    <div style={{ color: '#C9A227', fontWeight: 800, marginBottom: '5px' }}>
                      No faculty rankings yet
                    </div>
                    A faculty appears here once at least 10 of its students have
                    registered. Rankings will fill in as registration grows.
                  </div>
                ) : (
                  leaderboard.map((f, i) => (
                    <div key={f.name} className={`dash-lb-row ${f.rank === 1 ? 'top' : ''}`}>
                      <div>
                        {f.rank === 1 && <span className="dash-lb-medal gold">1</span>}
                        {f.rank === 2 && <span className="dash-lb-medal silver">2</span>}
                        {f.rank === 3 && <span className="dash-lb-medal bronze">3</span>}
                        {f.rank > 3 && <span className="dash-lb-rank">{f.rank}</span>}
                      </div>
                      <div className="dash-lb-info">
                        <div className="dash-lb-name">{f.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                          {f.total} students registered
                        </div>
                        <div className="dash-lb-bar-bg">
                          <div
                            className={`dash-lb-bar ${f.rank === 1 ? 'gold' : 'normal'}`}
                            style={{ width: `${barWidths[i] ?? 0}%`, transition: 'width 1.4s ease' }}
                          />
                        </div>
                      </div>
                      <div className="dash-lb-pct">{f.pct}%</div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </PageBackground>

      {/* VOTE POPUP */}
      <div className={`dash-popup-overlay ${showPopup ? 'show' : ''}`} onClick={(e: React.MouseEvent) => { if (e.target === e.currentTarget) setShowPopup(false) }}>
        <div className="dash-popup">
          <div className="dash-popup-icon"><ClipboardCheck size={48} color="#fff" /></div>
          <div className="dash-popup-title">Ready to Vote?</div>
          <div className="dash-popup-sub">
            You&apos;re about to cast your vote as<br />
            <strong>{user.name}</strong><br />
            This action <strong>cannot be undone</strong>.
          </div>
          <div className="dash-popup-actions">
            <button className="dash-popup-confirm" onClick={() => { setShowPopup(false); navigateTo('/ballot') }}>
              <CheckSquare size={16} />Go to Ballot
            </button>
            <button className="dash-popup-confirm gold" onClick={() => { setShowPopup(false); navigateTo('/candidates') }}>
              <Users size={16} />Browse Candidates First
            </button>
            <button className="dash-popup-cancel" onClick={() => setShowPopup(false)}>Not Yet</button>
          </div>
        </div>
      </div>
    </>
  )
}