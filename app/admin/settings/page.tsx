'use client'
import { useState, useEffect } from 'react'
import { Settings, Calendar, Send, Zap, AlertTriangle, CheckSquare, X } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import { createClient } from '@/lib/supabase/client'
import { useNavigate } from '@/lib/hooks'

export default function AdminSettingsPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [electionName, setElectionName] = useState('GCTU SRC Elections 2025/2026')
  const [academicYear, setAcademicYear] = useState('2025 / 2026')
  const [organisedBy, setOrganisedBy] = useState('Electoral Commission, GCTU')
  const [startDate, setStartDate] = useState('2025-11-10')
  const [startTime, setStartTime] = useState('08:00')
  const [endDate, setEndDate] = useState('2025-11-10')
  const [endTime, setEndTime] = useState('17:00')
  const [announcement, setAnnouncement] = useState('Voting is now open! Cast your ballot before 5:00 PM today. Your vote is anonymous and secure.')
  const [allowVoting, setAllowVoting] = useState(true)
  const [showResults, setShowResults] = useState(false)
  const [showProfiles, setShowProfiles] = useState(true)
  const [emailReceipts, setEmailReceipts] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmType, setConfirmType] = useState<'reset' | 'close' | 'reopen' | null>(null)
  const [toast, setToast] = useState('')

 useEffect(() => {
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') {
      navigateTo('/admin'); return
    }

    const { data } = await supabase
      .from('election_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (data) {
      setAllowVoting(data.is_open ?? true)
      setAnnouncement(data.announcement ?? '')

      if (data.start_time) {
        const start = new Date(data.start_time)
        setStartDate(start.toISOString().split('T')[0])
        setStartTime(start.toTimeString().slice(0, 5))
      }
      if (data.end_time) {
        const end = new Date(data.end_time)
        setEndDate(end.toISOString().split('T')[0])
        setEndTime(end.toTimeString().slice(0, 5))
      }
    }
  }

  load()
}, [])

async function saveSettings() {
  const supabase = createClient()

  const startISO = startDate && startTime
  ? new Date(`${startDate}T${startTime}:00`).toISOString()
  : null
const endISO = endDate && endTime
  ? new Date(`${endDate}T${endTime}:00`).toISOString()
  : null

  const { error } = await supabase
    .from('election_settings')
    .update({
      is_open: allowVoting,
      announcement: announcement.trim(),
      start_time: startISO,
      end_time: endISO,
    })
    .eq('id', 1)

  if (!error) {
    showToast('Settings saved successfully')
  } else {
    showToast('Failed to save settings')
  }
}
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  function openConfirm(type: 'reset' | 'close' | 'reopen') {
    setConfirmType(type)
    setConfirmOpen(true)
  }
   
  async function doAction() {
  const supabase = createClient()

  if (confirmType === 'close') {
    await supabase
      .from('election_settings')
      .update({ is_open: false })
      .eq('id', 1)
    setAllowVoting(false)
    showToast('Election closed')
  }

  if (confirmType === 'reopen') {
    await supabase
      .from('election_settings')
      .update({ is_open: true })
      .eq('id', 1)
    setAllowVoting(true)
    showToast('Election reopened')
  }

  if (confirmType === 'reset') {
    // Delete all ballots and reset voter registry
    await supabase.from('ballots').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('voter_registry').update({ has_voted: false, voted_at: null }).neq('id', '00000000-0000-0000-0000-000000000000')
    showToast('All votes reset')
  }

  setConfirmOpen(false)
}

  const confirmMessages = {
    reset: { title: 'Reset All Votes?', msg: 'This will permanently delete all ballots. This cannot be undone.' },
    close: { title: 'Force Close Election?', msg: 'Voting will stop immediately. Students cannot cast more ballots.' },
    reopen: { title: 'Reopen Election?', msg: 'Voting will reopen for students.' },
  }

  return (
    <>
      <div className={`admin-page${fadingOut ? ' fading-out' : ''}`}>
        <AdminNav />
        <div className="admin-content">

          <div className="admin-page-hdr fade-up-1">
            <h1><Settings size={20} color="#C9A227" className="verify-icon-inline" /> Election Settings</h1>
            <p>Configure and manage the SRC election</p>
          </div>

          {/* General */}
          <div className="admin-section gold-border fade-up-1">
            <div className="admin-section-title"><Zap size={14} color="#C9A227" className="verify-icon-inline" /> General</div>
            <div className="admin-form-field"><label className="admin-form-label">Election Name</label><input className="admin-form-input" value={electionName} onChange={e => setElectionName(e.target.value)} /></div>
            <div className="admin-form-field"><label className="admin-form-label">Academic Year</label><input className="admin-form-input" value={academicYear} onChange={e => setAcademicYear(e.target.value)} /></div>
            <div className="admin-form-field"><label className="admin-form-label">Organised By</label><input className="admin-form-input" value={organisedBy} onChange={e => setOrganisedBy(e.target.value)} /></div>
          </div>

          {/* Schedule */}
          <div className="admin-section gold-border fade-up-2">
            <div className="admin-section-title"><Calendar size={14} color="#C9A227" className="verify-icon-inline" /> Schedule</div>
            <div className="admin-form-row">
              <div className="admin-form-field"><label className="admin-form-label">Start Date</label><input className="admin-form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="admin-form-field"><label className="admin-form-label">Start Time</label><input className="admin-form-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-field"><label className="admin-form-label">End Date</label><input className="admin-form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
              <div className="admin-form-field"><label className="admin-form-label">End Time</label><input className="admin-form-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
            </div>
          </div>

          {/* Announcement */}
          <div className="admin-section gold-border fade-up-2">
            <div className="admin-section-title"><Send size={14} color="#C9A227" className="verify-icon-inline" /> Student Announcement</div>
            <div className="admin-form-field"><label className="admin-form-label">Banner Message</label><textarea className="admin-form-textarea" value={announcement} onChange={e => setAnnouncement(e.target.value)} /></div>
          </div>

          {/* Options */}
          <div className="admin-section gold-border fade-up-3">
            <div className="admin-section-title"><Zap size={14} color="#C9A227" className="verify-icon-inline" /> Options</div>
            {[
              { label: 'Allow Voting', sub: 'Students can cast their ballots', val: allowVoting, set: setAllowVoting },
              { label: 'Show Live Results', sub: 'Students can see running tallies', val: showResults, set: setShowResults },
              { label: 'Show Candidate Profiles', sub: 'Candidates page visible to students', val: showProfiles, set: setShowProfiles },
              { label: 'Email Receipts', sub: 'Send ballot receipt to student email', val: emailReceipts, set: setEmailReceipts },
            ].map(opt => (
              <div key={opt.label} className="admin-toggle-row">
                <div className="admin-toggle-info">
                  <div className="admin-toggle-info-text">
                    <div className="admin-t-title">{opt.label}</div>
                    <div className="admin-t-sub">{opt.sub}</div>
                  </div>
                </div>
                <label className="admin-toggle">
                  <input type="checkbox" checked={opt.val} onChange={() => opt.set(!opt.val)} />
                  <span className="admin-toggle-slider" />
                </label>
              </div>
            ))}
          </div>

          {/* Danger Zone */}
          <div className="admin-danger-zone fade-up-3">
            <div className="admin-danger-title"><AlertTriangle size={14} color="#EF4444" className="verify-icon-inline" /> Danger Zone</div>
            <button className="admin-danger-btn orange" onClick={() => openConfirm('close')}><X size={16} className="verify-icon-inline" /> Force Close Election</button>
            <button className="admin-danger-btn orange" onClick={() => openConfirm('reopen')}><CheckSquare size={16} className="verify-icon-inline" /> Reopen Election</button>
            <button className="admin-danger-btn red" onClick={() => openConfirm('reset')}><AlertTriangle size={16} className="verify-icon-inline" /> Reset All Votes</button>
          </div>

        </div>

        {/* Save Bar */}
        <div className="admin-save-bar">
         <button className="admin-save-btn" onClick={saveSettings}>
            <CheckSquare size={18} className="verify-icon-inline" /> Save Settings
          </button>
        </div>

      </div>

      {/* Confirm Modal */}
      <div className={`admin-confirm-overlay${confirmOpen ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setConfirmOpen(false) }}>
        <div className="admin-confirm-box">
          <div className="admin-confirm-icon"><AlertTriangle size={40} color="#EF4444" /></div>
          <div className="admin-confirm-title">{confirmType ? confirmMessages[confirmType].title : ''}</div>
          <div className="admin-confirm-msg">{confirmType ? confirmMessages[confirmType].msg : ''}</div>
          <div className="admin-confirm-btns">
            <button className="admin-btn-keep" onClick={() => setConfirmOpen(false)}>Cancel</button>
            <button className="admin-btn-del" onClick={doAction}><CheckSquare size={14} className="verify-icon-inline" /> Confirm</button>
          </div>
        </div>
      </div>

      {toast && <div className="admin-toast show">{toast}</div>}
    </>
  )
}
