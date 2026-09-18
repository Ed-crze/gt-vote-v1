'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, RefreshCw, Users, FileText, Zap, TrendingUp, Clock, CheckSquare, BarChart2 } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import { createClient } from '@/lib/supabase/client'
import { largestRemainderPercentages } from '@/lib/percentages'
import { useNavigate } from '@/lib/hooks'

// Known positions render in this order; anything else the admin has created is
// appended after them. Same list, same purpose as app/results/page.tsx.
const POSITION_ORDER = [
  'President',
  'Vice President',
  'General Secretary',
  'Financial Secretary',
  "Women's Commissioner",
  'Sports Officer',
]

export default function AdminDashboardPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [annOpen, setAnnOpen] = useState(false)
  const [annText, setAnnText] = useState('')
  const [toast, setToast] = useState('')
  const [countdown, setCountdown] = useState('00:00:00')
  const [barsReady, setBarsReady] = useState(false)
 const [totalVoters, setTotalVoters] = useState(0)
const [votesCast, setVotesCast] = useState(0)
const [turnout, setTurnout] = useState(0)
// Starts empty and is filled from the candidates table below. It used to be
// seeded from the hardcoded POSITIONS list in lib/data.ts, which meant this
// panel and the PDF rendered a candidate roster that had nothing to do with the
// database as soon as anyone added or renamed a candidate in the admin panel.
const [resultsData, setResultsData] = useState<{
  title: string
  total: number
  candidates: { id: string; name: string; votes: number; pct: number }[]
}[]>([])
const [votingOpen, setVotingOpen] = useState(false)
const endRef = useRef(Date.now() + 5 * 3600 * 1000)
// Live mirror of votingOpen for the countdown tick, whose setInterval closure
// is created once ([] deps) and would otherwise read the initial value forever.
const votingOpenRef = useRef(false)
const [facultyTurnout, setFacultyTurnout] = useState<{ name: string; pct: number }[]>([])
const [sendingReminder, setSendingReminder] = useState<'opening' | 'closing' | null>(null)
const autoPublishedRef = useRef(false)


useEffect(() => {
  const supabase = createClient()

  async function loadDashboard() {
    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') {
      navigateTo('/admin')
      return
    }

    // Get total registered voters
    const { count: voterCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })

    // Get total votes cast (unique receipt codes)
    const { count: ballotCount } = await supabase
      .from('voter_registry')
      .select('*', { count: 'exact', head: true })
      .eq('has_voted', true)

    const total = voterCount ?? 0
    const cast = ballotCount ?? 0
    setTotalVoters(total)
    setVotesCast(cast)
    setTurnout(total > 0 ? Math.round((cast / total) * 100) : 0)

    // Get election settings
    const { data: settings } = await supabase
      .from('election_settings')
      .select('is_open, announcement,end_time')
      .eq('id', 1)
      .single()

    if (settings) {
      if (settings.announcement) setAnnText(settings.announcement)

      const timeExpired = settings.end_time
        ? new Date(settings.end_time).getTime() < Date.now()
        : false
      if (settings.end_time) endRef.current = new Date(settings.end_time).getTime()

      // Voting open only if admin set it open AND time hasn't expired
      const open = Boolean(settings.is_open) && !timeExpired
      setVotingOpen(open)
      votingOpenRef.current = open

      // A closed poll has no time left to show, however far off end_time is.
      // Manually closing voting used to leave the clock running next to the
      // "Voting is currently CLOSED" panel.
      if (!open) setCountdown('Closed')
    }

// Real per-faculty turnout, from the same security-definer aggregate the
// student dashboard reads. This block used to count students per faculty and
// then hand EVERY faculty the single overall turnout figure, so the bars were
// always identical no matter how the faculties actually differed.
// get_faculty_turnout() suppresses any faculty with fewer than 10
// registrations, so zero rows is a legitimate answer rather than a pending one.
const { data: facultyTurnoutRows } = await supabase.rpc('get_faculty_turnout')

const sorted = (facultyTurnoutRows ?? [])
  .map((f: any) => ({
    name: String(f.faculty).replace('Faculty of ', ''),
    pct: Number(f.turnout_pct),
    registered: Number(f.registered),
  }))
  // Rank by actual turnout, with registration count breaking ties.
  .sort((a: any, b: any) => b.pct - a.pct || b.registered - a.registered)
  .map(({ name, pct }: { name: string; pct: number }) => ({ name, pct }))

setFacultyTurnout(sorted)


    // Live results per position. The roster comes from the candidates table —
    // the same source app/results/page.tsx reads — so this panel, the public
    // results page and the PDF can no longer disagree about who is standing.
    const [{ data: candidateData }, { data: ballots }] = await Promise.all([
      supabase
        .from('candidates')
        .select('id, full_name, position')
        .order('position'),
      supabase
        .from('ballots')
        .select('position, candidate_id'),
    ])

    if (candidateData) {
      const voteByCandidate = new Map<string, number>()
      for (const b of ballots ?? []) {
        const key = String(b.candidate_id)
        voteByCandidate.set(key, (voteByCandidate.get(key) ?? 0) + 1)
      }

      const allPositions = Array.from(new Set(candidateData.map(c => c.position)))
      const orderedPositions = [
        ...POSITION_ORDER.filter(p => allPositions.includes(p)),
        ...allPositions.filter(p => !POSITION_ORDER.includes(p)),
      ]

      const results = orderedPositions.map(posTitle => {
        const posCandidates = candidateData.filter(c => c.position === posTitle)
        const voteCounts = posCandidates.map(c => voteByCandidate.get(c.id) ?? 0)
        // Total is the sum of this position's own candidates rather than a raw
        // ballot count, so the "N votes" header and the percentages under it
        // always agree — a ballot for a since-deleted candidate cannot inflate
        // the header past what the rows add up to.
        const total = voteCounts.reduce((sum, v) => sum + v, 0)
        // Percentages are allocated across the position in one pass so the
        // displayed figures sum to exactly 100 rather than to 101.
        const pcts = largestRemainderPercentages(voteCounts)
        const candidates = posCandidates
          .map((c, i) => ({
            id: c.id,
            name: c.full_name,
            votes: voteCounts[i],
            pct: pcts[i],
          }))
          // Sort by votes descending
          .sort((a, b) => b.votes - a.votes)
        return { title: posTitle, total, candidates }
      })
      setResultsData(results)
    }

    setTimeout(() => setBarsReady(true), 300)
  }

  loadDashboard()

  // Countdown timer
const interval = setInterval(() => {
  // Election state wins over the clock: once is_open is false there is nothing
  // to count down to, so show Closed rather than a running end_time.
  if (!votingOpenRef.current) {
    setCountdown('Closed')
    return
  }
  const diff = endRef.current - Date.now()
  if (diff <= 0) {
    setCountdown('Closed')
    setVotingOpen(false)
    votingOpenRef.current = false
    // Auto-close in the database and publish results (once) when time expires
    if (!autoPublishedRef.current) {
      autoPublishedRef.current = true
      createClient()
        .from('election_settings')
        .update({ is_open: false, show_results: true })
        .eq('id', 1)
    }
    return
  }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
}, 1000)

return () => {
  clearInterval(interval)
}
}, [])


async function handleVotingToggle() {
  const supabase = createClient()
  const newState = !votingOpen

  // Closing voting also auto-publishes the final results to students.
  const update = newState
    ? { is_open: true }
    : { is_open: false, show_results: true }

  const { error } = await supabase
    .from('election_settings')
    .update(update)
    .eq('id', 1)

  if (!error) {
    setVotingOpen(newState)
    votingOpenRef.current = newState
    if (!newState) setCountdown('Closed')
    showToast(newState ? 'Voting opened' : 'Voting closed — results published')
  } else {
    showToast('Failed to update voting status')
  }
}


  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2800)
  }

  async function sendAnnouncement() {
  if (!annText.trim()) return
  const supabase = createClient()

  const { error } = await supabase
    .from('election_settings')
    .update({ announcement: annText.trim() })
    .eq('id', 1)

  if (!error) {
    setAnnOpen(false)
    showToast('Announcement sent to all students')
  } else {
    showToast('Failed to send announcement')
  }
}
  async function sendReminders(type: 'opening' | 'closing') {
    if (sendingReminder) return // guard against double-send
    setSendingReminder(type)
    showToast(type === 'opening' ? 'Sending opening announcement...' : 'Reminding non-voters...')
    try {
      const res = await fetch('/api/send-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (res.ok) {
        if (data.sent === 0 && data.firstError) {
          showToast(`Send failed: ${data.firstError}`)
        } else {
          showToast(`Sent ${data.sent} of ${data.total} email${data.total === 1 ? '' : 's'}`)
        }
      } else {
        showToast(data.error || 'Failed to send reminders')
      }
    } catch {
      showToast('Failed to send reminders')
    } finally {
      setSendingReminder(null)
    }
  }

  async function handleExportPDF() {
  showToast('Generating PDF...')
  try {
    const { generateResultsPDF } = await import('@/lib/generateResultsPDF')
    generateResultsPDF({
      totalVoters,
      votesCast,
      turnout,
      resultsData: resultsData,
      generatedAt: new Date().toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }),
    })
    showToast('PDF downloaded successfully')
  } catch (err) {
    console.error('PDF generation failed:', err)
    showToast('Failed to generate PDF')
  }
}

  return (
    <>
      <div className={`admin-page${fadingOut ? ' fading-out' : ''}`}>
        <AdminNav />
        <div className="admin-content">

          
         {/* Page Header */}
          <div className="admin-page-hdr fade-up-1">
            <div className="flex items-center justify-between">
              <div>
                <h1><BarChart2 size={20} color="#C9A227" className="verify-icon-inline" /> Dashboard</h1>
                <p>Live election overview</p>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="admin-stats-row fade-up-1">
            <div className="admin-stat-card">
              <div className="admin-stat-val">{totalVoters.toLocaleString()}</div>
              <div className="admin-stat-lbl">Total Voters</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-val">{votesCast.toLocaleString()}</div>
              <div className="admin-stat-lbl">Votes Cast</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-val">{turnout}%</div>
              <div className="admin-stat-lbl">Turnout</div>
            </div>
            <div className="admin-stat-card">
              <div className="admin-stat-val admin-countdown">{countdown}</div>
              <div className="admin-stat-lbl">Time Left</div>
            </div>
          </div>

          {/* Voting Control */}
          <div className="admin-sec-title fade-up-2">
            <Zap size={14} color="#C9A227" className="verify-icon-inline" /> Voting Control
          </div>
          <div className="admin-voting-status fade-up-2">
            <div>
              <div className="admin-vs-title">{votingOpen ? 'Voting is currently OPEN' : 'Voting is currently CLOSED'}</div>
              <div className="admin-vs-sub">{votingOpen ? 'Students can cast their ballots' : 'No new votes are being accepted'}</div>
            </div>
            <label className="admin-toggle">
              <input type="checkbox" checked={votingOpen} onChange={handleVotingToggle} />
              <span className="admin-toggle-slider" />
            </label>
          </div>

          {/* Quick Actions */}
          <div className="admin-sec-title fade-up-2">
            <Zap size={14} color="#C9A227" className="verify-icon-inline" /> Quick Actions
          </div>
          <div className="admin-actions-grid fade-up-2">
            <div className="admin-action-btn gold" onClick={() => setAnnOpen(true)}>
              <div className="admin-action-icon"><Send size={22} color="#C9A227" /></div>
              <div className="admin-action-label">Post Announcement</div>
              <div className="admin-action-sub">Push to student dashboard</div>
            </div>
            <div className="admin-action-btn green" onClick={() => showToast('Results refreshed')}>
              <div className="admin-action-icon"><RefreshCw size={22} color="#22C55E" /></div>
              <div className="admin-action-label">Refresh Results</div>
              <div className="admin-action-sub">Pull latest vote counts</div>
            </div>
            <div className="admin-action-btn blue" onClick={() => navigateTo('/admin/candidates')}>
              <div className="admin-action-icon"><Users size={22} color="#3B82F6" /></div>
              <div className="admin-action-label">Manage Candidates</div>
              <div className="admin-action-sub">Add, edit, remove</div>
            </div>
            <div className="admin-action-btn red" onClick={handleExportPDF}>
              <div className="admin-action-icon"><FileText size={22} color="#EF4444" /></div>
              <div className="admin-action-label">Export Results PDF</div>
              <div className="admin-action-sub">Full election report</div>
            </div>
            <div
              className="admin-action-btn gold"
              onClick={() => { if (!sendingReminder) sendReminders('opening') }}
              style={{ opacity: sendingReminder ? 0.6 : 1, pointerEvents: sendingReminder ? 'none' : 'auto' }}
            >
              <div className="admin-action-icon"><Send size={22} color="#C9A227" /></div>
              <div className="admin-action-label">{sendingReminder === 'opening' ? 'Sending...' : 'Send Opening Announcement'}</div>
              <div className="admin-action-sub">Email all registered students</div>
            </div>
            <div
              className="admin-action-btn green"
              onClick={() => { if (!sendingReminder) sendReminders('closing') }}
              style={{ opacity: sendingReminder ? 0.6 : 1, pointerEvents: sendingReminder ? 'none' : 'auto' }}
            >
              <div className="admin-action-icon"><Clock size={22} color="#22C55E" /></div>
              <div className="admin-action-label">{sendingReminder === 'closing' ? 'Sending...' : 'Remind Non-Voters'}</div>
              <div className="admin-action-sub">Email students who haven&apos;t voted</div>
            </div>
          </div>

          {/* Live Results */}
          <div className="admin-sec-title fade-up-3">
            <TrendingUp size={14} color="#C9A227" className="verify-icon-inline" /> Live Results
          </div>
          <div className="fade-up-3">
            {resultsData.length === 0 ? (
              <div className="admin-pos-result">
                <div style={{
                  textAlign: 'center',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  color: 'rgba(255,255,255,0.3)',
                }}>
                  No candidates have been added yet.
                </div>
              </div>
            ) : resultsData.map(pos => (
             <div key={pos.title} className="admin-pos-result">
  <div className="admin-pos-res-title">
    {pos.title} <span>{pos.total} votes</span>
  </div>
  {pos.total === 0 ? (
    <div style={{
      textAlign: 'center',
      padding: '1rem',
      fontSize: '0.8rem',
      color: 'rgba(255,255,255,0.3)',
    }}>
      No votes cast yet
    </div>
  ) : (
    pos.candidates.map((c, ci) => (
      <div key={c.id} className="admin-cand-result">
        <div className="admin-cand-head">
          <div className="admin-cand-name">
            {c.name}
            {ci === 0 && pos.total > 0 && (
              <span className="admin-leading-badge">Leading</span>
            )}
          </div>
          <div className="admin-cand-pct">{c.votes} ({c.pct}%)</div>
        </div>
        <div className="admin-res-bar-bg">
          <div
            className={`admin-result-bar${ci === 0 ? ' leader' : ''}`}
            style={{ width: barsReady ? `${c.pct}%` : '0%' }}
          />
        </div>
      </div>
    ))
                )}
              </div>
            ))}
          </div>

          {/* Faculty Turnout */}
          <div className="admin-sec-title fade-up-3">
            <TrendingUp size={14} color="#C9A227" className="verify-icon-inline" /> Faculty Turnout
          </div>
          <div className="admin-fac-card fade-up-3">
            {facultyTurnout.length === 0 ? (
              <div className="admin-fac-row">
                <div className="admin-fac-name">Not enough registrations to report faculty turnout yet</div>
              </div>
            ) : facultyTurnout.map(f => (
              <div key={f.name} className="admin-fac-row">
                <div className="admin-fac-name">{f.name}</div>
                <div className="admin-fac-bar-bg">
                  <div className="admin-fac-bar" style={{ width: barsReady ? `${f.pct}%` : '0%' }} />
                </div>
                <div className="admin-fac-pct">{f.pct}%</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Announcement Modal */}
      <div className={`admin-modal-overlay${annOpen ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setAnnOpen(false) }}>
        <div className="admin-modal-sheet">
          <div className="admin-modal-handle" />
          <div className="admin-modal-title"><Send size={18} color="#C9A227" className="verify-icon-inline" /> Post Announcement</div>
          <div className="admin-modal-sub">This will appear on all student dashboards immediately.</div>
          <textarea className="admin-modal-textarea" placeholder="Type your announcement here..." value={annText} onChange={e => setAnnText(e.target.value)} />
          <button className="admin-modal-btn" onClick={sendAnnouncement}>
            <CheckSquare size={16} className="verify-icon-inline" /> Send to All Students
          </button>
          <button className="admin-modal-cancel" onClick={() => setAnnOpen(false)}>Cancel</button>
        </div>
      </div>

      {/* Toast */}
      {toast && <div className="admin-toast show">{toast}</div>}
    </>
  )
}
