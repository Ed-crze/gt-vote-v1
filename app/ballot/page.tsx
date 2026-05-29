'use client'
import { useState, useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { hashStudentId, saveReceiptToSession } from '@/lib/auth-client'
import { useNavigate } from '@/lib/hooks'

type Candidate = {
  id: string
  name: string
  faculty: string
  level: string
  slogan: string
  avatar_url: string | null
  highlights?: string[]
}

type Position = {
  id: string
  title: string
  candidates: Candidate[]
}

const POSITION_ORDER = [
  'President',
  'Vice President',
  'General Secretary',
  'Financial Secretary',
  "Women's Commissioner",
  'Sports Officer',
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('')
}

export default function BallotPage() {
  const { navigateTo, fadingOut } = useNavigate()

  const [user, setUser] = useState<{
    id: string
    name: string
    studentId: string
  } | null>(null)

  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [currentTab, setCurrentTab] = useState(0)
  const [selections, setSelections] = useState<(number | null)[]>([])
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoPending, setInfoPending] = useState<{ pos: number; cand: number } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successVisible, setSuccessVisible] = useState(false)
  const [receiptCode, setReceiptCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function loadData() {
      // Auth check
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { navigateTo('/login'); return }

      // Get student profile
      const { data: profile } = await supabase
        .from('students')
        .select('full_name, student_id')
        .eq('id', authUser.id)
        .single()

      if (!profile) { navigateTo('/login'); return }

      // Check if already voted
      const hash = await hashStudentId(profile.student_id)
      const { data: registry } = await supabase
        .from('voter_registry')
        .select('has_voted')
        .eq('student_id_hash', hash)
        .single()

      if (registry?.has_voted) { navigateTo('/dashboard'); return }

      setUser({
        id: authUser.id,
        name: profile.full_name,
        studentId: profile.student_id,
      })

      // Load candidates from database
      const { data: candidateData, error } = await supabase
        .from('candidates')
        .select('id, full_name, position, faculty, level, slogan, avatar_url')
        .order('position')

      if (candidateData && !error) {
        const grouped = POSITION_ORDER
          .map(posTitle => ({
            id: posTitle.toLowerCase().replace(/\s+/g, '-'),
            title: posTitle,
            candidates: candidateData
              .filter(c => c.position === posTitle)
              .map(c => ({
                id: c.id,
                name: c.full_name,
                faculty: c.faculty ?? '',
                level: c.level ?? '',
                slogan: c.slogan ?? '',
                avatar_url: c.avatar_url ?? null,
              }))
          }))
          .filter(p => p.candidates.length > 0) // only show positions with candidates

        setPositions(grouped)
        setSelections(Array(grouped.length).fill(null))
      }

      setLoading(false)
    }

    loadData()
  }, [])

  useEffect(() => {
    const el = tabRefs.current[currentTab]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [currentTab])

  const TOTAL = positions.length
  const doneCnt = selections.filter(s => s !== null).length
  const allDone = doneCnt === TOTAL && TOTAL > 0

  function selectCandidate(pos: number, cand: number) {
    setSelections(prev => {
      const next = [...prev]
      next[pos] = cand
      return next
    })
  }

  function openInfo(pos: number, cand: number) {
    setInfoPending({ pos, cand })
    setInfoOpen(true)
  }

  function confirmSelect() {
    if (!infoPending) return
    selectCandidate(infoPending.pos, infoPending.cand)
    setInfoOpen(false)
  }

  function nextOrSubmit() {
    if (currentTab < TOTAL - 1) setCurrentTab(currentTab + 1)
    else { setSubmitError(''); setReviewOpen(true) }
  }

  async function submitBallot() {
    if (!user) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const supabase = createClient()

      const votes = positions
        .map((pos, i) => {
          if (selections[i] === null) return null
          const candidate = pos.candidates[selections[i]!]
          return {
            candidate_id: candidate.id,
            position: pos.title,
          }
        })
        .filter(Boolean)

      const hash = await hashStudentId(user.studentId)

      const { data: receipt, error } = await supabase.rpc('submit_vote', {
        p_student_id_hash: hash,
        p_votes: votes,
      })

      if (error) {
        if (error.message?.includes('ALREADY_VOTED')) {
          navigateTo('/dashboard')
          return
        }
        throw error
      }

      await saveReceiptToSession(receipt)
      sessionStorage.setItem('gt_receipt', receipt)

      setReceiptCode(receipt)
      setReviewOpen(false)
      setSuccessVisible(true)
      setTimeout(() => navigateTo('/dashboard?voted=true'), 4500)

    } catch (err: any) {
      console.error('Vote submission failed:', err)
      setSubmitError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function copyCode() {
    if (!receiptCode) return
    navigator.clipboard?.writeText(receiptCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0D1B3E', flexDirection: 'column', gap: '16px',
      }}>
        <span className="spin" style={{
          display: 'inline-block', width: '32px', height: '32px',
          border: '3px solid rgba(201,162,39,0.3)', borderTopColor: '#C9A227', borderRadius: '50%',
        }} />
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>Loading ballot...</div>
      </div>
    )
  }

  if (!user || positions.length === 0) return null

  const pos = positions[currentTab]
  const isThree = pos?.candidates.length === 3
  const infoPos = infoPending ? positions[infoPending.pos] : null
  const infoCand = infoPending ? positions[infoPending.pos]?.candidates[infoPending.cand] : null
  const isAlreadySelected = infoPending !== null && selections[infoPending.pos] === infoPending.cand

  return (
    <>
      {/* Main Page */}
      <div className={`ballot-page${fadingOut ? ' fading-out' : ''}`}>

        {/* Top Nav */}
        <nav className="ballot-nav">
          <div className="ballot-nav-left">
            <img src="/gctu-crest.png" alt="GCTU" className="ballot-nav-crest" loading="eager" />
            <div className="ballot-nav-title">GT<span>-Vote</span></div>
          </div>
          <div className="ballot-nav-prog">{doneCnt} of {TOTAL} done</div>
        </nav>

        {/* Page Header */}
        <div className="ballot-page-hdr fade-up-1">
          <div className="ballot-page-lbl">Official Ballot 2025 / 2026</div>
          <div className="ballot-page-ttl">Cast Your Vote</div>
        </div>

        {/* Progress Bar */}
        <div className="ballot-prog-wrap fade-up-2">
          <div className="ballot-prog-top">
            <span>Positions completed</span>
            <strong>{doneCnt} / {TOTAL}</strong>
          </div>
          <div className="ballot-prog-bar">
            <div className="ballot-prog-fill" style={{ width: `${TOTAL > 0 ? (doneCnt / TOTAL) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="ballot-tabs-wrap fade-up-3">
          <div className="ballot-tabs hide-scrollbar">
            {positions.map((p, i) => (
              <button
                key={p.id}
                ref={el => { tabRefs.current[i] = el }}
                className={`ballot-tab${i === currentTab ? ' active' : ''}${selections[i] !== null && i !== currentTab ? ' done' : ''}`}
                onClick={() => setCurrentTab(i)}
              >
                <span className="ballot-tabdot">{selections[i] !== null ? '✓' : '●'}</span>
                {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Candidate Cards */}
        <div className="ballot-panels fade-up-4">
          <div className="ballot-pos-title">{pos.title}</div>
          <div className="ballot-pos-sub">Tap a candidate to view details and select</div>
          <div className={`ballot-c-grid${isThree ? ' three' : ''}`}>
            {pos.candidates.map((cand, ci) => {
              const selected = selections[currentTab] === ci
              return (
                <div
                  key={cand.id}
                  className={`ballot-c-card${selected ? ' selected' : ''}`}
                  onClick={() => openInfo(currentTab, ci)}
                >
                  <div className={`ballot-c-check${selected ? ' show' : ''}`}>✓</div>

                  {/* Photo or initials */}
                  <div className="ballot-c-avatar-wrap" style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    overflow: 'hidden', margin: '0 auto 10px',
                    background: selected ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.08)',
                    border: selected ? '2px solid #C9A227' : '2px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {cand.avatar_url ? (
                      <img
                        src={cand.avatar_url}
                        alt={cand.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{
                        fontSize: '1.2rem', fontWeight: 700,
                        color: selected ? '#C9A227' : 'rgba(255,255,255,0.5)',
                      }}>
                        {getInitials(cand.name)}
                      </span>
                    )}
                  </div>

                  <div className="ballot-c-name">{cand.name}</div>
                  <div className="ballot-c-fac">{cand.faculty}</div>
                  <div className={`ballot-c-btn${selected ? ' selected' : ''}`}>
                    {selected ? 'Selected' : 'View & Select'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="ballot-bottom-bar">
          <div className="ballot-btns">
            <button
              className="ballot-btn-back"
              onClick={() => currentTab > 0 && setCurrentTab(currentTab - 1)}
              disabled={currentTab === 0}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              className={`ballot-btn-next${allDone && currentTab === TOTAL - 1 ? ' submit' : ''}`}
              onClick={nextOrSubmit}
              disabled={selections[currentTab] === null || (currentTab === TOTAL - 1 && !allDone)}
            >
              {currentTab === TOTAL - 1
                ? (allDone ? 'Review Ballot' : 'Select a candidate first')
                : (selections[currentTab] !== null ? 'Next →' : 'Select a candidate first')
              }
            </button>
          </div>
        </div>
      </div>

      {/* Candidate Info Sheet */}
      <div
        className={`ballot-info-overlay${infoOpen ? ' show' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) setInfoOpen(false) }}
      >
        <div className="ballot-info-sheet">
          <div className="ballot-info-handle" />
          {infoCand && infoPos && (
            <>
              <div className="ballot-info-head">
                {/* Photo in info sheet */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  overflow: 'hidden', flexShrink: 0,
                  background: 'rgba(255,255,255,0.08)',
                  border: '2px solid rgba(201,162,39,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {infoCand.avatar_url ? (
                    <img
                      src={infoCand.avatar_url}
                      alt={infoCand.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#C9A227' }}>
                      {getInitials(infoCand.name)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="ballot-info-nm">{infoCand.name}</div>
                  <div className="ballot-info-fc">{infoCand.faculty}</div>
                  {infoCand.level && (
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                      Level {infoCand.level}
                    </div>
                  )}
                </div>
              </div>

              {infoCand.slogan && (
                <div className="ballot-info-slogan">&quot;{infoCand.slogan}&quot;</div>
              )}

              <div className="ballot-info-hl-title">Running for: {infoPos.title}</div>

              <button
                className={`ballot-info-sel-btn${isAlreadySelected ? ' already' : ''}`}
                onClick={confirmSelect}
              >
                {isAlreadySelected ? '✓ Already Selected' : '✓ Select This Candidate'}
              </button>
              <button className="ballot-info-cancel" onClick={() => setInfoOpen(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <div
        className={`ballot-rev-overlay${reviewOpen ? ' show' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) setReviewOpen(false) }}
      >
        <div className="ballot-rev-modal">
          <div className="ballot-rev-handle" />
          <div className="ballot-rev-title">Review Your Ballot</div>
          <div className="ballot-rev-sub">Confirm your choices before submitting.</div>

          {positions.map((p, i) => (
            <div key={p.id} className="ballot-rev-row">
              <div className="ballot-rev-pos">{p.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Mini photo in review */}
                {selections[i] !== null && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    overflow: 'hidden', flexShrink: 0,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(201,162,39,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {p.candidates[selections[i]!]?.avatar_url ? (
                      <img
                        src={p.candidates[selections[i]!]!.avatar_url!}
                        alt={p.candidates[selections[i]!]!.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#C9A227' }}>
                        {getInitials(p.candidates[selections[i]!]?.name ?? '')}
                      </span>
                    )}
                  </div>
                )}
                <div className="ballot-rev-name">
                  {selections[i] !== null ? p.candidates[selections[i]!].name : '-'}
                </div>
              </div>
            </div>
          ))}

          {/* Inline error instead of alert */}
          {submitError && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              margin: '12px 0',
              fontSize: '0.85rem',
              color: '#EF4444',
              display: 'flex', gap: '8px', alignItems: 'flex-start',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {submitError}
            </div>
          )}

          <div className="ballot-rev-warn">
            This action cannot be undone. Your ballot is anonymous and encrypted.
          </div>

          <button
            className="ballot-btn-confirm"
            onClick={submitBallot}
            disabled={submitting}
          >
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span className="spin" style={{
                  display: 'inline-block', width: '15px', height: '15px',
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%',
                }} />
                Submitting...
              </span>
            ) : 'Submit My Ballot'}
          </button>
          <button
            className="ballot-btn-edit"
            onClick={() => { setReviewOpen(false); setSubmitError('') }}
          >
            Go Back and Edit
          </button>
        </div>
      </div>

      {/* Success Screen */}
      <div className={`ballot-success${successVisible ? ' show' : ''}`}>
        <div className="ballot-s-icon pop-in">🎉</div>
        <div className="ballot-s-title">Vote Cast Successfully!</div>
        <div className="ballot-s-sub">
          Your ballot has been recorded.<br />Your identity remains completely anonymous.
        </div>
        <div className="ballot-receipt" onClick={copyCode} title="Click to copy">
          <div className="ballot-r-lbl">
            Ballot Receipt Code &nbsp;
            <span className="ballot-copy-hint" style={{ color: copied ? '#22C55E' : 'rgba(201,162,39,0.7)' }}>
              {copied ? 'copied!' : 'tap to copy'}
            </span>
          </div>
          <div className="ballot-r-code">{receiptCode || '------'}</div>
        </div>
        <div className="ballot-r-note" style={{ color: copied ? '#22C55E' : undefined }}>
          {copied ? 'Code copied to clipboard!' : 'Save this code to verify your vote was counted.'}
        </div>
      </div>
    </>
  )
}