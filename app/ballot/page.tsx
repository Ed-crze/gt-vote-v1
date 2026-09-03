'use client'
import { useState, useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

// Exceptions raised by submit_vote(p_votes jsonb). Longest token first —
// ALREADY_VOTED_OR_NOT_REGISTERED contains NOT_REGISTERED as a substring.
const SUBMIT_ERRORS: [string, string][] = [
  ['NOT_AUTHENTICATED', 'Your session has expired. Please sign in again, then cast your ballot.'],
  ['NO_VOTES_SUBMITTED', 'No selections reached the server. Please choose a candidate for every position and try again.'],
  ['ELECTION_CLOSED', 'Voting is now closed. Your ballot was not submitted.'],
  ['INVALID_CANDIDATE', 'One of your selections is no longer a valid candidate. Reload the page and select again.'],
  ['RECEIPT_GENERATION_FAILED', 'Your ballot could not be finalised. Nothing was recorded — please try again.'],
  ['NOT_REGISTERED', 'You are not on the voter register for this election. Please contact the Electoral Commission.'],
]

function messageForSubmitError(raw: string) {
  for (const [token, message] of SUBMIT_ERRORS) {
    if (raw.includes(token)) return message
  }
  return 'Something went wrong submitting your ballot. Please try again.'
}

// ── Replay protection (client half) ───────────────────────────────────────
// A nonce is persisted BEFORE the RPC fires. If the response is lost to a
// dropped connection, the retry comes back ALREADY_VOTED_OR_NOT_REGISTERED —
// the marker tells us that ballot was almost certainly ours, so we report it
// as recorded instead of silently bouncing the student to the dashboard.
// Once p_request_id exists server-side the same nonce makes the retry return
// the original receipt instead (see the fallback in submitBallot).
const REQUEST_KEY = 'gt_vote_request_id'
const RECEIPT_KEY = 'gt_receipt'

// Returns the nonce to send plus whether an earlier attempt was left
// unresolved. isRetry is true only when a previous submission never received
// an answer — that is the one case where a later ALREADY_VOTED response may
// be describing our own ballot.
function beginRequest(): { id: string; isRetry: boolean } {
  try {
    const existing = localStorage.getItem(REQUEST_KEY)
    if (existing) return { id: existing, isRetry: true }
    const id = crypto.randomUUID()
    localStorage.setItem(REQUEST_KEY, id)
    return { id, isRetry: false }
  } catch {
    return { id: crypto.randomUUID(), isRetry: false }
  }
}

function clearRequest() {
  try { localStorage.removeItem(REQUEST_KEY) } catch {}
}

function persistReceipt(code: string) {
  // localStorage first — it is the only copy that survives a tab close, and
  // the receipt can never be recovered from the server again.
  try { localStorage.setItem(RECEIPT_KEY, code) } catch {}
  try { sessionStorage.setItem(RECEIPT_KEY, code) } catch {}
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
  const [receiptSaved, setReceiptSaved] = useState(false)
  const [receiptLost, setReceiptLost] = useState(false)

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

      // Check if already voted. voter_registry is no longer directly readable;
      // has_current_user_voted() derives the voter from auth.uid() server-side.
      const { data: hasVoted } = await supabase.rpc('has_current_user_voted')

      if (hasVoted) { navigateTo('/dashboard'); return }

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
        // Collect every position that actually exists in the data
        const allPositions = Array.from(new Set(candidateData.map(c => c.position)))

        // Known positions first (in defined order), then any custom ones
        const orderedPositions = [
          ...POSITION_ORDER.filter(p => allPositions.includes(p)),
          ...allPositions.filter(p => !POSITION_ORDER.includes(p)),
        ]

        const grouped = orderedPositions
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

      // Position is derived server-side from the candidate — send candidate_id only.
      const votes = positions
        .map((pos, i) => {
          if (selections[i] === null) return null
          return { candidate_id: pos.candidates[selections[i]!].id }
        })
        .filter(Boolean)

      const { id: requestId, isRetry } = beginRequest()

      // Try the replay-safe signature first. Until the p_request_id migration
      // is applied PostgREST answers PGRST202 (no such function), and we fall
      // back to the single-argument form the live database currently exposes.
      let { data: receipt, error } = await supabase.rpc('submit_vote', {
        p_votes: votes,
        p_request_id: requestId,
      })

      if (error && error.code === 'PGRST202') {
        ;({ data: receipt, error } = await supabase.rpc('submit_vote', {
          p_votes: votes,
        }))
      }

      // A PostgREST error carries a code; a transport failure does not. Only
      // the latter leaves the outcome genuinely unknown, so only that keeps
      // the nonce alive for the next attempt to recognise.
      const answered = !error || !!error.code
      if (answered) clearRequest()

      if (error) {
        if (!error.code) {
          setSubmitError(
            'The connection dropped before we heard back, so we cannot tell whether ' +
            'your ballot was recorded. Check your network and try again — you will ' +
            'not be counted twice.'
          )
          return
        }

        const raw = error.message ?? ''

        if (raw.includes('ALREADY_VOTED_OR_NOT_REGISTERED')) {
          // A ballot already exists for this voter. If an earlier attempt was
          // left unresolved, that ballot is almost certainly ours and only the
          // response was lost — say so rather than bouncing silently.
          if (isRetry) {
            setReceiptLost(true)
            setReviewOpen(false)
            setSuccessVisible(true)
            return
          }
          navigateTo('/dashboard')
          return
        }

        setSubmitError(messageForSubmitError(raw))
        return
      }

      // Persist before anything else can navigate — this is the only copy.
      persistReceipt(receipt)

      fetch('/api/send-vote-confirmation', { method: 'POST' }).catch(() => {})

      setReceiptCode(receipt)
      setReviewOpen(false)
      setSuccessVisible(true)
      // No automatic redirect — the student must tick "I have saved my
      // receipt code" before they can leave. The code is unrecoverable.

    } catch (err: any) {
      // Thrown, so no answer was received — the nonce stays put deliberately.
      console.error('Vote submission failed:', err)
      setSubmitError(messageForSubmitError(err?.message ?? ''))
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
                        style={{ width: '100%', height: '100%', objectFit: 'cover',objectPosition: 'top center' }}
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
                      style={{ width: '100%', height: '100%', objectFit: 'cover',objectPosition: 'top center'}}
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
                        style={{ width: '100%', height: '100%', objectFit: 'cover',objectPosition: 'top center'}}
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

        {receiptLost ? (
          /* The ballot landed but the response was lost in transit. Receipts
             cannot be recovered from the server, so be explicit rather than
             showing a blank code. */
          <>
            <div style={{
              background: 'rgba(201,162,39,0.1)',
              border: '1px solid rgba(201,162,39,0.35)',
              borderRadius: '12px',
              padding: '14px 16px',
              width: '100%', maxWidth: '300px',
              fontSize: '0.78rem', lineHeight: 1.6,
              color: 'rgba(255,255,255,0.75)',
              textAlign: 'left',
            }}>
              <strong style={{ color: '#C9A227', display: 'block', marginBottom: '4px' }}>
                Your vote is counted.
              </strong>
              The connection dropped before your receipt code reached this device,
              and receipts cannot be recovered after submission. Your ballot is
              safely recorded and will be tallied.
            </div>
            <button
              className="ballot-btn-confirm"
              style={{ maxWidth: '300px' }}
              onClick={() => navigateTo('/dashboard?voted=true')}
            >
              Continue to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="ballot-receipt" style={{ cursor: 'default' }}>
              <div className="ballot-r-lbl">Ballot Receipt Code</div>
              <div className="ballot-r-code">{receiptCode || '------'}</div>
              <button
                onClick={copyCode}
                style={{
                  display: 'block', width: '100%', marginTop: '12px', padding: '10px',
                  background: copied ? 'rgba(34,197,94,0.15)' : '#C9A227',
                  border: copied ? '1px solid rgba(34,197,94,0.5)' : 'none',
                  borderRadius: '9px',
                  fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 900,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: copied ? '#22C55E' : '#1B2A5E',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>

            <div style={{
              display: 'flex', gap: '8px', alignItems: 'flex-start',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '11px 13px',
              margin: '14px 0 4px',
              width: '100%', maxWidth: '300px',
              fontSize: '0.76rem', lineHeight: 1.5,
              color: '#EF4444', textAlign: 'left',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span><strong>Save this code now. It cannot be recovered.</strong> No one — not
              even an administrator — can look it up again after you leave this screen.</span>
            </div>

            <label style={{
              display: 'flex', gap: '9px', alignItems: 'center',
              width: '100%', maxWidth: '300px',
              margin: '10px 0 2px',
              fontSize: '0.8rem', fontWeight: 700,
              color: receiptSaved ? '#C9A227' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer', textAlign: 'left', transition: 'color 0.2s',
            }}>
              <input
                type="checkbox"
                checked={receiptSaved}
                onChange={e => setReceiptSaved(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#C9A227', cursor: 'pointer', flexShrink: 0 }}
              />
              I have saved my receipt code
            </label>

            <button
              className="ballot-btn-confirm"
              disabled={!receiptSaved}
              onClick={() => navigateTo('/dashboard?voted=true')}
              style={{
                maxWidth: '300px',
                opacity: receiptSaved ? 1 : 0.4,
                cursor: receiptSaved ? 'pointer' : 'not-allowed',
              }}
            >
              Continue to Dashboard
            </button>

            <div className="ballot-r-note">
              You will need this code to verify your ballot was counted.
            </div>
          </>
        )}
      </div>
    </>
  )
}