'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, FileText, Download } from 'lucide-react'
import { GTV } from '@/lib/store'
import { useNavigate } from '@/lib/hooks'
import { POSITIONS } from '@/lib/data'
import type { Student } from '@/lib/types'

export default function CandidatesPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [currentTab, setCurrentTab] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalPos, setModalPos] = useState(0)
  const [modalCand, setModalCand] = useState(0)
  const [user, setUser] = useState<Student | null>(null)

  useEffect(() => {
    setUser(GTV.getCurrentUser())
  }, [])

  function openModal(pos: number, cand: number) {
    setModalPos(pos)
    setModalCand(cand)
    setModalOpen(true)
  }

  const pos = POSITIONS[currentTab]
  const candidate = POSITIONS[modalPos]?.candidates[modalCand]
  const posTitle = POSITIONS[modalPos]?.title

  // Short tab labels
  const tabLabels = ['President', 'Vice President', 'Gen. Secretary', 'Fin. Secretary', "Women's Comm.", 'Sports Officer']

  // Section label
  const sectionLabels = [
    'PRESIDENTIAL CANDIDATES',
    'VICE PRESIDENTIAL CANDIDATES',
    'GENERAL SECRETARY CANDIDATES',
    'FINANCIAL SECRETARY CANDIDATES',
    "WOMEN'S COMMISSIONER CANDIDATES",
    'SPORTS & RECREATION OFFICER CANDIDATES',
  ]


  // Define this function once in your component (e.g. right above your return/JSX)
const handleManifestoDownload = (candidate: { manifesto_url?: string | null | undefined }) => {
  if (candidate.manifesto_url) {
    window.open(candidate.manifesto_url, '_blank');
  } else {
    alert('Manifesto PDF not yet available for this candidate.');
  }
};

  // Initials from name
  function getInitials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('')
  }

  return (
    <>
      <div className={`cand-page${fadingOut ? ' fading-out' : ''}`}>

        {/* Nav */}
        <nav className="cand-nav">
          <div className="cand-nav-left">
            <Image src="/gctu-crest.png" alt="GCTU" width={36} height={36} className="cand-nav-crest"  loading="eager" priority/>
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
            {tabLabels.map((label, i) => (
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
          {sectionLabels[currentTab]}
        </div>

        {/* Candidate Cards */}
        <div className="cand-grid fade-up-3">
          {pos.candidates.map((cand, ci) => (
            <div key={cand.name} className="cand-card">
              <div className="cand-avatar">
                <span>{getInitials(cand.name)}</span>
              </div>
              <div className="cand-name">{cand.name}</div>
              <div className="cand-faculty">{cand.faculty}</div>
              <div className="cand-slogan">"{cand.slogan}"</div>
              <button className="cand-view-btn" onClick={() => openModal(currentTab, ci)}>
                View Profile
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="cand-bottom-bar">
          <button
            className="cand-proceed-btn"
            onClick={() => navigateTo(user ? '/ballot' : '/login')}
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
          <button className="cand-modal-close" onClick={() => setModalOpen(false)}><X size={14} /></button>

          {candidate && (
            <>
              <div className="cand-modal-avatar">
                <span>{getInitials(candidate.name)}</span>
              </div>
              <div className="cand-modal-name">{candidate.name}</div>
              <div className="cand-modal-position">{posTitle}</div>
              <div className="cand-modal-faculty">{candidate.faculty}</div>
              <div className="cand-modal-slogan">"{candidate.slogan}"</div>
              <div className="cand-modal-hl-title">
                <FileText size={13} className="verify-icon-inline" /> Manifesto Highlights
              </div>
              <div className="cand-modal-hl">
                {candidate.highlights.map((h, i) => (
                  <div key={i}>• {h}</div>
                ))}
              </div>
              <button className="cand-modal-dl-btn" onClick={() => handleManifestoDownload(candidate)}>
                <Download size={14} className="verify-icon-inline" />
                {candidate.manifesto_url ? 'Download Full Manifesto (PDF)' : 'Manifesto Coming Soon'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
