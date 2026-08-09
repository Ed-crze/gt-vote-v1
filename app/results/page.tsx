'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Trophy, ArrowLeft } from 'lucide-react'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
import PageBackground from '@/components/PageBackground'

type ResultCandidate = {
  id: string
  name: string
  faculty: string
  avatar_url: string | null
  votes: number
  pct: number
}

type PositionResult = {
  title: string
  total: number
  candidates: ResultCandidate[]
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

export default function ResultsPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [positions, setPositions] = useState<PositionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [barsReady, setBarsReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      // Must be logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigateTo('/login'); return }

      // Gate: only viewable once voting has closed AND admin published results
      const { data: settings } = await supabase
        .from('election_settings')
        .select('is_open, end_time, show_results')
        .eq('id', 1)
        .single()

      const timeExpired = settings?.end_time
        ? new Date(settings.end_time).getTime() < Date.now()
        : false
      const votingOpen = (settings?.is_open ?? false) && !timeExpired
      const showResults = settings?.show_results ?? false

      if (votingOpen || !showResults) {
        navigateTo('/dashboard')
        return
      }

      // Aggregate-only: candidates + ballot tallies. No link to voter_registry.
      const { data: candidateData } = await supabase
        .from('candidates')
        .select('id, full_name, position, faculty, avatar_url')
        .order('position')

      const { data: ballots } = await supabase
        .from('ballots')
        .select('position, candidate_id')

      if (candidateData) {
        const allPositions = Array.from(new Set(candidateData.map(c => c.position)))
        const orderedPositions = [
          ...POSITION_ORDER.filter(p => allPositions.includes(p)),
          ...allPositions.filter(p => !POSITION_ORDER.includes(p)),
        ]

        const grouped = orderedPositions.map(posTitle => {
          const posBallots = (ballots ?? []).filter(b => b.position === posTitle)
          const total = posBallots.length
          const candidates = candidateData
            .filter(c => c.position === posTitle)
            .map(c => {
              const votes = posBallots.filter(b => b.candidate_id === c.id).length
              const pct = total > 0 ? Math.round((votes / total) * 100) : 0
              return {
                id: c.id,
                name: c.full_name,
                faculty: c.faculty ?? '',
                avatar_url: c.avatar_url ?? null,
                votes,
                pct,
              }
            })
            .sort((a, b) => b.votes - a.votes)
          return { title: posTitle, total, candidates }
        })

        setPositions(grouped)
      }

      setLoading(false)
      setTimeout(() => setBarsReady(true), 300)
    }

    load()
  }, [])

  return (
    <PageBackground fadingOut={fadingOut}>
      <div className="results-page" style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '3rem' }}>

        {/* Nav */}
        <nav style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.9rem 1.25rem',
          borderBottom: '1.5px solid rgba(201,162,39,0.35)',
          background: 'rgba(8,16,45,0.6)', backdropFilter: 'blur(12px)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Image src="/gctu-crest.png" alt="GCTU" width={34} height={34} style={{ objectFit: 'contain' }} loading="eager" priority />
            <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap' }}>
              GT<span style={{ color: '#C9A227' }}>-Vote</span>
            </div>
          </div>
          <button
            onClick={() => navigateTo('/dashboard')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif',
              fontSize: '0.72rem', fontWeight: 600, padding: '7px 12px',
              borderRadius: '8px', cursor: 'pointer',
            }}
          >
            <ArrowLeft size={13} /> Back
          </button>
        </nav>

        <div style={{ maxWidth: '560px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>

          {/* Header */}
          <div className="fade-up-1" style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '0.62rem', fontWeight: 800, color: '#C9A227',
              textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem',
            }}>
              🏁 Final Results
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: '0.4rem' }}>
              Election Results
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
              2025 / 2026 SRC Elections — official tally
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
              <span className="spin" style={{
                display: 'inline-block', width: '28px', height: '28px',
                border: '3px solid rgba(201,162,39,0.3)', borderTopColor: '#C9A227',
                borderRadius: '50%', marginBottom: '12px',
              }} />
              <div>Loading results...</div>
            </div>
          ) : positions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
              No results to display yet.
            </div>
          ) : (
            positions.map((pos, pi) => (
              <div
                key={pos.title}
                className={`fade-up-${Math.min(pi + 1, 3)}`}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '18px', padding: '1.1rem 1.15rem', marginBottom: '1rem',
                }}
              >
                {/* Position title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#fff' }}>{pos.title}</div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                    {pos.total} vote{pos.total === 1 ? '' : 's'}
                  </div>
                </div>

                {pos.total === 0 ? (
                  <div style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
                    No votes recorded
                  </div>
                ) : (
                  pos.candidates.map((c, ci) => {
                    const isWinner = ci === 0 && c.votes > 0
                    return (
                      <div key={c.id} style={{ marginBottom: ci === pos.candidates.length - 1 ? 0 : '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          {/* Avatar */}
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(201,162,39,0.15)',
                            border: `1.5px solid ${isWinner ? '#C9A227' : 'rgba(255,255,255,0.15)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden',
                            fontSize: '0.75rem', fontWeight: 800, color: '#C9A227',
                          }}>
                            {c.avatar_url ? (
                              <img src={c.avatar_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', borderRadius: '50%' }} />
                            ) : (
                              <span>{getInitials(c.name)}</span>
                            )}
                          </div>

                          {/* Name + faculty */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{c.name}</span>
                              {isWinner && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  fontSize: '0.55rem', fontWeight: 800,
                                  background: 'rgba(201,162,39,0.2)', border: '1px solid rgba(201,162,39,0.45)',
                                  color: '#C9A227', padding: '1px 7px', borderRadius: '999px',
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                }}>
                                  <Trophy size={9} /> Winner
                                </span>
                              )}
                            </div>
                            {c.faculty && (
                              <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.4)' }}>{c.faculty}</div>
                            )}
                          </div>

                          {/* Count + pct */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 900, color: isWinner ? '#C9A227' : '#fff' }}>{c.pct}%</div>
                            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>{c.votes} vote{c.votes === 1 ? '' : 's'}</div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px',
                            width: barsReady ? `${c.pct}%` : '0%',
                            background: isWinner ? 'linear-gradient(to right, #C9A227, #f0d060)' : '#fff',
                            transition: 'width 1.2s ease',
                          }} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            ))
          )}

          {/* Back to dashboard */}
          {!loading && (
            <button
              onClick={() => navigateTo('/dashboard')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                width: '100%', marginTop: '0.5rem', padding: '13px',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '12px', fontFamily: 'Inter, sans-serif',
                fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
              }}
            >
              <ArrowLeft size={15} /> Back to Dashboard
            </button>
          )}

        </div>
      </div>
    </PageBackground>
  )
}
