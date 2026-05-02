'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, RefreshCw, Users, FileText, Zap, TrendingUp, Clock, CheckSquare, BarChart2 } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import { createClient } from '@/lib/supabase/client'
import { POSITIONS } from '@/lib/data'
import { useNavigate } from '@/lib/hooks'

const FACULTY_DATA = [
  { name: 'Faculty of IT', pct: 82 },
  { name: 'Faculty of Engineering', pct: 74 },
  { name: 'Faculty of Computing', pct: 68 },
  { name: 'Faculty of Business', pct: 61 },
  { name: 'Faculty of Applied Sci.', pct: 47 },
]

const RESULTS_DATA = POSITIONS.map((pos, i) => {
  const total = 312
  const counts = pos.candidates.map((_, ci) => {
    const base = [43, 36, 21, 57, 43, 46, 31, 22, 60, 40, 39, 35, 26, 53, 47]
    return base[i * 3 + ci] || 33
  })
  return { title: pos.title, total, candidates: pos.candidates.map((c, ci) => ({ name: c.name, pct: counts[ci], votes: Math.round(total * counts[ci] / 100) })) }
})

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
const [resultsData, setResultsData] = useState<typeof RESULTS_DATA>([])
const [votingOpen, setVotingOpen] = useState(false)


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
      .select('is_open, announcement')
      .eq('id', 1)
      .single()

    if (settings) {
      setVotingOpen(settings.is_open)
      if (settings.announcement) setAnnText(settings.announcement)
    }

    // Get live results per position
    const { data: ballots } = await supabase
      .from('ballots')
      .select('position, candidate_id')

    if (ballots) {
      const results = POSITIONS.map(pos => {
        const positionBallots = ballots.filter(b => b.position === pos.title)
        const total = positionBallots.length
        const candidates = pos.candidates.map(c => {
          const votes = positionBallots.filter(b => b.candidate_id === c.id).length
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0
          return { name: c.name, votes, pct }
        })
        // Sort by votes descending
        candidates.sort((a, b) => b.votes - a.votes)
        return { title: pos.title, total, candidates }
      })
      setResultsData(results)
    }

    setTimeout(() => setBarsReady(true), 300)
  }

  loadDashboard()

  // Countdown timer
  const interval = setInterval(() => {
    const end = new Date(); end.setHours(17, 0, 0, 0)
    const diff = end.getTime() - Date.now()
    if (diff <= 0) { setCountdown('Closed'); return }
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
  }, 1000)

  return () => clearInterval(interval)
}, [])


async function handleVotingToggle() {
  const supabase = createClient()
  const newState = !votingOpen

  const { error } = await supabase
    .from('election_settings')
    .update({ is_open: newState })
    .eq('id', 1)

  if (!error) {
    setVotingOpen(newState)
    showToast(newState ? 'Voting opened' : 'Voting closed')
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
  async function handleExportPDF() {
  showToast('Generating PDF...')
  try {
    const { generateResultsPDF } = await import('@/lib/generateResultsPDF')
    generateResultsPDF({
      totalVoters,
      votesCast,
      turnout,
      resultsData: resultsData.length > 0 ? resultsData : RESULTS_DATA,
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
          </div>

          {/* Live Results */}
          <div className="admin-sec-title fade-up-3">
            <TrendingUp size={14} color="#C9A227" className="verify-icon-inline" /> Live Results
          </div>
          <div className="fade-up-3">
           {(resultsData.length > 0 ? resultsData : RESULTS_DATA).map(pos => (
              <div key={pos.title} className="admin-pos-result">
                <div className="admin-pos-res-title">{pos.title} <span>{pos.total} votes</span></div>
                {pos.candidates.map((c, ci) => (
                  <div key={c.name} className="admin-cand-result">
                    <div className="admin-cand-head">
                      <div className="admin-cand-name">
                        {c.name}
                        {ci === 0 && <span className="admin-leading-badge">Leading</span>}
                      </div>
                      <div className="admin-cand-pct">{c.votes} ({c.pct}%)</div>
                    </div>
                    <div className="admin-res-bar-bg">
                      <div className={`admin-result-bar${ci === 0 ? ' leader' : ''}`} style={{ width: barsReady ? `${c.pct}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Faculty Turnout */}
          <div className="admin-sec-title fade-up-3">
            <TrendingUp size={14} color="#C9A227" className="verify-icon-inline" /> Faculty Turnout
          </div>
          <div className="admin-fac-card fade-up-3">
            {FACULTY_DATA.map(f => (
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
