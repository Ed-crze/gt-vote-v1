'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, FileText, Download } from 'lucide-react'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'

type Candidate = {
  id: string
  name: string
  faculty: string
  level: string
  slogan: string
  manifesto_url: string | null
  avatar_url: string | null
  position: string
}

type PositionGroup = {
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

const TAB_LABELS = ['President', 'Vice President', 'Gen. Secretary', 'Fin. Secretary', "Women's Comm.", 'Sports Officer']

const SECTION_LABELS = [
  'PRESIDENTIAL CANDIDATES',
  'VICE PRESIDENTIAL CANDIDATES',
  'GENERAL SECRETARY CANDIDATES',
  'FINANCIAL SECRETARY CANDIDATES',
  "WOMEN'S COMMISSIONER CANDIDATES",
  'SPORTS & RECREATION OFFICER CANDIDATES',
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('')
}

export default function CandidatesPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [currentTab, setCurrentTab] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [positions, setPositions] = useState<PositionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)

      // Load candidates from database
      const { data, error } = await supabase
        .from('candidates')
        .select('id, full_name, position, faculty, level, slogan, manifesto_url, avatar_url')
        .order('position')

      if (data && !error) {
        // Group by position in the correct order
        const grouped = POSITION_ORDER.map(posTitle => ({
          title: posTitle,
          candidates: data
            .filter(c => c.position === posTitle)
            .map(c => ({
              id: c.id,
              name: c.full_name,
              faculty: c.faculty ?? '',
              level: c.level ?? '',
              slogan: c.slogan ?? '',
              manifesto_url: c.manifesto_url ?? null,
              avatar_url: c.avatar_url ?? null,
              position: c.position,
            }))
        }))
        setPositions(grouped)
      }

      setLoading(false)
    }

    load()
  }, [])

  function openModal(candidate: Candidate) {
    setSelectedCandidate(candidate)
    setModalOpen(true)
  }

  function handleManifestoDownload(candidate: Candidate) {
    if (candidate.manifesto_url) {
      window.open(candidate.manifesto_url, '_blank')
    } else {
      alert('Manifesto PDF not yet available for this candidate.')
    }
  }

  const currentPosition = positions[currentTab]

  return (
    <>
      <div className={`cand-page${fadingOut ? ' fading-out' : ''}`}>

        {/* Nav */}
        <nav className="cand-nav">
          <div className="cand-nav-left">
            <Image src="/gctu-crest.png" alt="GCTU" width={36} height={36} className="cand-nav-crest" loading="eager" priority />
            <div className="cand-nav-title">GT<span>-Vote</span></div>
          </div>
          <button className="cand-nav-back" onClick={() => navigateTo('/dashboard')}>
            ← Back
          </button>
        </nav>

        {/* Page Header */}
        <div className="cand-header fade-up-1">
          <div className="cand-header-label">2025 / 2026 SRC Elections</div>
          <div className="cand-header-title">Meet the Candidates</div>
          <div className="cand-header-sub">Tap a candidate to view their profile &amp; manifesto</div>
        </div>

        {/* Position Tabs */}
        <div className="cand-tabs-wrap fade-up-2">
          <div className="cand-tabs hide-scrollbar">
            {TAB_LABELS.map((label, i) => (
              <button
                key={i}
                id={`cand-tab-${i}`}
                className={`cand-tab${i === currentTab ? ' active' : ''}`}
                onClick={() => setCurrentTab(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Section Label */}
        <div className="cand-section-label fade-up-3">
          {SECTION_LABELS[currentTab]}
        </div>

        {/* Candidate Cards */}
        <div className="cand-grid fade-up-3">
          {loading ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '3rem',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.9rem',
            }}>
              <span className="spin" style={{
                display: 'inline-block', width: '24px', height: '24px',
                border: '3px solid rgba(201,162,39,0.3)',
                borderTopColor: '#C9A227', borderRadius: '50%',
                marginBottom: '12px',
              }} />
              <div>Loading candidates...</div>
            </div>
          ) : !currentPosition || currentPosition.candidates.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '3rem',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.9rem',
            }}>
              No candidates registered for this position yet.
            </div>
          ) : (
            currentPosition.candidates.map(cand => (
              <div key={cand.id} className="cand-card">
                <div className="cand-avatar">
                  {cand.avatar_url ? (
                    <img
                      src={cand.avatar_url}
                      alt={cand.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%',objectPosition: 'top center' }}
                    />
                  ) : (
                    <span>{getInitials(cand.name)}</span>
                  )}
                </div>
                <div className="cand-name">{cand.name}</div>
                <div className="cand-faculty">{cand.faculty}</div>
                {cand.slogan && (
                  <div className="cand-slogan">&quot;{cand.slogan}&quot;</div>
                )}
                <button className="cand-view-btn" onClick={() => openModal(cand)}>
                  View Profile
                </button>
              </div>
            ))
          )}
        </div>

        {/* Bottom Bar */}
        <div className="cand-bottom-bar">
          <button
            className="cand-proceed-btn"
            onClick={() => navigateTo(isLoggedIn ? '/ballot' : '/login')}
          >
            PROCEED TO VOTE →
          </button>
        </div>

      </div>

      {/* Profile Modal */}
      <div
        className={`cand-modal-overlay${modalOpen ? ' show' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
      >
        <div className="cand-modal">
          <div className="cand-modal-handle" />
          <button className="cand-modal-close" onClick={() => setModalOpen(false)}>
            <X size={14} />
          </button>

          {selectedCandidate && (
            <>
              <div className="cand-modal-avatar">
                {selectedCandidate.avatar_url ? (
                  <img
                    src={selectedCandidate.avatar_url}
                    alt={selectedCandidate.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center',borderRadius: '50%' }}
                  />
                ) : (
                  <span>{getInitials(selectedCandidate.name)}</span>
                )}
              </div>
              <div className="cand-modal-name">{selectedCandidate.name}</div>
              <div className="cand-modal-position">{selectedCandidate.position}</div>
              <div className="cand-modal-faculty">{selectedCandidate.faculty}</div>
              {selectedCandidate.level && (
                <div className="cand-modal-faculty" style={{ fontSize: '0.78rem', opacity: 0.7 }}>
                  Level {selectedCandidate.level}
                </div>
              )}
              {selectedCandidate.slogan && (
                <div className="cand-modal-slogan">&quot;{selectedCandidate.slogan}&quot;</div>
              )}
              <div className="cand-modal-hl-title">
                <FileText size={13} className="verify-icon-inline" /> Manifesto
              </div>
              <button
                className="cand-modal-dl-btn"
                onClick={() => handleManifestoDownload(selectedCandidate)}
              >
                <Download size={14} className="verify-icon-inline" />
                {selectedCandidate.manifesto_url
                  ? 'Download Full Manifesto (PDF)'
                  : 'Manifesto Coming Soon'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}