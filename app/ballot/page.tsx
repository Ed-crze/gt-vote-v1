'use client'
import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { hashStudentId, saveReceiptToSession } from '@/lib/auth-client'
import { useNavigate } from '@/lib/hooks'
import { POSITIONS } from '@/lib/data'


const TOTAL = POSITIONS.length

export default function BallotPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [user, setUser] = useState<{
  id: string
  name: string
  studentId: string
} | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [currentTab, setCurrentTab] = useState(0)
  const [selections, setSelections] = useState<(number | null)[]>(Array(TOTAL).fill(null))
  const [infoOpen, setInfoOpen] = useState(false)
  const [infoPending, setInfoPending] = useState<{ pos: number; cand: number } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [successVisible, setSuccessVisible] = useState(false)
  const [receiptCode, setReceiptCode] = useState('')
  const [copied, setCopied] = useState(false)

 useEffect(() => {
  const supabase = createClient()

  async function loadUser() {
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
  }

  loadUser()
}, [])

  useEffect(() => {
    const el = tabRefs.current[currentTab]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [currentTab])

  const doneCnt = selections.filter(s => s !== null).length
  const allDone = doneCnt === TOTAL

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
    else setReviewOpen(true)
  }

 async function submitBallot() {
  if (!user) return

  try {
    const supabase = createClient()

    // Build votes array for the submit_vote function
    const votes = POSITIONS
      .map((pos, i) => {
        if (selections[i] === null) return null
        const candidate = pos.candidates[selections[i]!]
        return {
          candidate_id: candidate.id, // make sure your POSITIONS data has candidate IDs
          position: pos.title,
        }
      })
      .filter(Boolean)

    // Hash the student ID for the Voting Paradox
    const hash = await hashStudentId(user.studentId)

    // Call the submit_vote database function
    const { data: receipt, error } = await supabase
      .rpc('submit_vote', {
        p_student_id_hash: hash,
        p_votes: votes,
      })

    console.log('submit_vote response:', { receipt, error })
    console.log('votes being sent:', JSON.stringify(votes))
    console.log('hash:', hash)

    if (error) {
      console.error('Supabase error:', error.message, error.code, error.details, error.hint)
      if (error.message?.includes('ALREADY_VOTED')) {
        navigateTo('/dashboard')
        return
      }
      throw error
    }

    // Save receipt to session so dashboard can display it
    await saveReceiptToSession(receipt)

    // Store in sessionStorage as backup
    sessionStorage.setItem('gt_receipt', receipt)

    setReceiptCode(receipt)
    setReviewOpen(false)
    setSuccessVisible(true)
    setTimeout(() => navigateTo('/dashboard?voted=true'), 4500)

  } catch (err) {
    console.error('Vote submission failed:', err)
    alert('Something went wrong submitting your vote. Please try again.')
  }
}
  function copyCode() {
    if (!receiptCode) return
    navigator.clipboard?.writeText(receiptCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  if (!user) return null

  const pos = POSITIONS[currentTab]
  const isThree = pos.candidates.length === 3
  const infoPos = infoPending ? POSITIONS[infoPending.pos] : null
  const infoCand = infoPending ? POSITIONS[infoPending.pos].candidates[infoPending.cand] : null
  const isAlreadySelected = infoPending !== null && selections[infoPending.pos] === infoPending.cand

  return (
    <>
      {/* Main Page */}
      <div className={`ballot-page${fadingOut ? ' fading-out' : ''}`}>

        {/* Top Nav */}
        <nav className="ballot-nav">
          <div className="ballot-nav-left">
            <img src="/gctu-crest.png" alt="GCTU" className="ballot-nav-crest"  loading="eager"/>
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
            <div className="ballot-prog-fill" style={{ width: `${(doneCnt / TOTAL) * 100}%` }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="ballot-tabs-wrap fade-up-3">
          <div className="ballot-tabs hide-scrollbar">
            {POSITIONS.map((p, i) => (
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
          <div className="ballot-pos-sub">Tap a candidate to view highlights and select</div>
          <div className={`ballot-c-grid${isThree ? ' three' : ''}`}>
            {pos.candidates.map((cand, ci) => {
              const selected = selections[currentTab] === ci
              return (
                <div
                  key={cand.name}
                  className={`ballot-c-card${selected ? ' selected' : ''}`}
                  onClick={() => openInfo(currentTab, ci)}
                >
                  <div className={`ballot-c-check${selected ? ' show' : ''}`}>✓</div>
                  <div className="ballot-c-avatar-wrap">
                    <Users size={28} color={selected ? '#C9A227' : 'rgba(255,255,255,0.4)'} />
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
                <div className="ballot-info-av-wrap">
                  <Users size={26} color="rgba(255,255,255,0.5)" />
                </div>
                <div>
                  <div className="ballot-info-nm">{infoCand.name}</div>
                  <div className="ballot-info-fc">{infoCand.faculty}</div>
                </div>
              </div>
              <div className="ballot-info-slogan">"{infoCand.slogan}"</div>
              <div className="ballot-info-hl-title">Manifesto Highlights</div>
              <div className="ballot-info-hl">
                {infoCand.highlights.map((h, i) => (
                  <div key={i}>• {h}</div>
                ))}
              </div>
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
          {POSITIONS.map((p, i) => (
            <div key={p.id} className="ballot-rev-row">
              <div className="ballot-rev-pos">{p.title}</div>
              <div className="ballot-rev-name">
                {selections[i] !== null ? p.candidates[selections[i]!].name : '-'}
              </div>
            </div>
          ))}
          <div className="ballot-rev-warn">
            This action cannot be undone. Your ballot is anonymous and encrypted.
          </div>
          <button className="ballot-btn-confirm" onClick={submitBallot}>
            Submit My Ballot
          </button>
          <button className="ballot-btn-edit" onClick={() => setReviewOpen(false)}>
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
