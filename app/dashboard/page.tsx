'use client'
import React, { useEffect, useState, useRef } from 'react'
import { Bell, User, Send, Award, BarChart2, CheckSquare, Users, Search, LogOut, ChevronDown, X, ClipboardCheck } from 'lucide-react'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth-client'
import PageBackground from '@/components/PageBackground'

export default function DashboardPage() {
  const { navigateTo, fadingOut } = useNavigate()

  const [user, setUser] = useState<{
    id: string
    name: string
    faculty: string
    voted: boolean
    receiptCode: string | null
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
  const [turnoutOffset, setTurnoutOffset] = useState(163.36)
  const endRef = useRef(Date.now() + 14 * 3600 * 1000)
  const notifRef = useRef<HTMLDivElement>(null)
const [votingOpen, setVotingOpen] = useState(true)

  useEffect(() => {
  const supabase = createClient()

  async function loadUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { navigateTo('/login'); return }

    const { data: profile } = await supabase
      .from('students')
      .select('full_name, faculty, student_id')
      .eq('id', authUser.id)
      .single()

    if (!profile) {
      const { signOut } = await import('@/lib/auth-client')
      await signOut()
      navigateTo('/login')
      return
    }

    const { hashStudentId } = await import('@/lib/auth-client')
    const hash = await hashStudentId(profile.student_id)

    const { data: registry } = await supabase
      .from('voter_registry')
      .select('has_voted')
      .eq('student_id_hash', hash)
      .single()

    const hasVoted = registry?.has_voted ?? false
    let receiptCode = null

    if (hasVoted) {
      const { data: ballot } = await supabase.rpc('get_receipt_for_session')
      receiptCode = ballot ?? null
    }

    setUser({
      id: authUser.id,
      name: profile.full_name,
      faculty: profile.faculty,
      voted: hasVoted,
      receiptCode,
    })

    // ── Load election settings ──────────────────────────────
    const { data: settings } = await supabase
      .from('election_settings')
      .select('is_open, announcement, start_time, end_time')
      .eq('id', 1)
      .single()

    if (settings) {
      // Set announcement
      if (settings.announcement) setAnnouncement(settings.announcement)

      // Set voting open/closed state
      setVotingOpen(settings.is_open ?? false)

      // Set countdown end time from database
      if (settings.end_time) {
        endRef.current = new Date(settings.end_time).getTime()
      }
    }

    // ── Load real turnout data ──────────────────────────────
    const { data: facultyData } = await supabase
      .from('students')
      .select('faculty')

    const { data: registryData } = await supabase
      .from('voter_registry')
      .select('has_voted')

    if (facultyData && registryData) {
      const totalReg = facultyData.length
      const rawVotes = registryData.filter(r => r.has_voted).length
      const totalVotes = Math.min(rawVotes, totalReg)
      const pct = totalReg > 0
        ? Math.min(Math.round((totalVotes / totalReg) * 100), 100)
        : 0

      const facultyCounts: Record<string, number> = {}
      facultyData.forEach(s => {
        if (s.faculty) {
          facultyCounts[s.faculty] = (facultyCounts[s.faculty] || 0) + 1
        }
      })

      const sorted = Object.entries(facultyCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], i) => ({
          name: name.replace('Faculty of ', ''),
          pct,
          total: count,
          rank: i + 1,
        }))

      setLeaderboard(sorted)
      setTotalRegistered(totalReg)
      setTurnoutPct(pct)

      setTimeout(() => {
        setBarWidths(sorted.map(() => pct))
        const circumference = 163.36
        setTurnoutOffset(circumference - (pct / 100) * circumference)
      }, 400)
    }

    const params = new URLSearchParams(window.location.search)
    if (params.get('voted') === 'true') launchConfetti()
  }

  loadUser()

  // Countdown timer — reads from endRef which is now set from database
  const tick = setInterval(() => {
    const diff = endRef.current - Date.now()
    if (diff <= 0) {
      setCountdown('Closed')
      setUrgent(false)
      return
    }
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    setUrgent(diff < 2 * 3600 * 1000)
  }, 1000)

  const handleClick = (e: MouseEvent) => {
    if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
      setShowNotif(false)
    }
  }
  document.addEventListener('click', handleClick)
  return () => { clearInterval(tick); document.removeEventListener('click', handleClick) }
}, [])

  const doLogout = async () => {
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

  if (!user) return null

  const navName = user.name.split(' ').slice(0, 2).join(' ')
  const faculty = user.faculty?.replace('Faculty of ', '') ?? 'Information Technology'

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

            {/* Vote button */}
            <div className="dash-vote-wrap">
              {user.voted ? (
                <>
                  <button className="dash-voted-btn">
                    <CheckSquare size={16} />Already Voted
                  </button>
                  {user.receiptCode && (
                    <div className="dash-receipt">
                      <div className="dash-receipt-label">Your Receipt Code</div>
                      <div className="dash-receipt-code">{user.receiptCode}</div>
                    </div>
                  )}
                </>
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
          

            {/* Meet the Candidates */}
            <div className="dash-ghost-wrap">
              <button className="dash-ghost-btn" onClick={() => navigateTo('/candidates')}>
                <Users size={16} />Meet the Candidates
              </button>
            </div>

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
                {leaderboard.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>
                    Loading leaderboard...
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