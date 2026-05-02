'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useNavigate } from '@/lib/hooks'
import { FACULTY_LEADERBOARD } from '@/lib/data'

export default function HomePage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [slide, setSlide] = useState(0)
  const [countdown, setCountdown] = useState('14:00:00')
  const endRef = useRef(Date.now() + 14 * 3600 * 1000)

  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startAutoPlay() {
    if (autoRef.current) clearInterval(autoRef.current)
    autoRef.current = setInterval(() => setSlide(s => (s + 1) % 3), 8000)
  }

  function goToSlide(idx: number) {
    setSlide(idx)
    startAutoPlay() // reset timer on manual tap
  }

  useEffect(() => {
    startAutoPlay()
    const tick = setInterval(() => {
      const diff = endRef.current - Date.now()
      if (diff <= 0) { setCountdown('Closed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }, 1000)
    return () => { if (autoRef.current) clearInterval(autoRef.current); clearInterval(tick) }
  }, [])

  const slides = [
    <div key="hero" className="flex flex-col items-center justify-center text-center px-6 py-8">
      <div className="text-xs font-bold text-gold uppercase tracking-widest mb-2">Student Union Elections</div>
      <div className="flex justify-center gap-1 mb-3">
        {['#c4a236','#1e2c59','#c4a236','#9896a3','#c4a236','#1e2c59','#c4a236'].map((c, i) => (
          <div key={i} className="h-1.5 w-6 rounded-sm" style={{ background: c }} />
        ))}
      </div>
      <h1 className="text-5xl font-black text-white leading-none mb-2" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
        GT<span className="text-gold">-Vote</span>
      </h1>
      <div className="text-base font-bold text-white/75 mb-3 tracking-wide">2025 / 2026 Academic Year</div>
      <p className="text-sm text-white/70 leading-relaxed max-w-xs">
        <strong className="text-white">Secure. Anonymous. Your voice matters.</strong><br />
        Cast your vote for the next GCTU Student Union leaders.
      </p>
    </div>,

    <div key="stats" className="flex flex-col items-center justify-center text-center px-6 py-8 w-full">
      <div className="text-xs font-bold text-gold uppercase tracking-widest mb-4">Election at a Glance</div>
      <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
        {[
          { val: '3,248', lbl: 'Registered Voters' },
          { val: '67%',   lbl: 'Turnout So Far' },
          { val: countdown, lbl: 'Time Left' },
        ].map(({ val, lbl }) => (
          <div key={lbl} className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)' }}>
            <div className="text-xl font-black text-gold leading-none">{val}</div>
            <div className="text-[0.6rem] text-white/60 font-bold uppercase tracking-wide mt-1">{lbl}</div>
          </div>
        ))}
      </div>
    </div>,

    <div key="lb" className="flex flex-col items-center justify-center px-6 py-8 w-full">
      <div className="text-xs font-bold text-gold uppercase tracking-widest mb-4">Faculty Leaderboard</div>
      <div className="w-full max-w-sm space-y-2.5">
        {FACULTY_LEADERBOARD.map((f) => (
          <div key={f.name} className="flex items-center gap-2.5">
            <div className={`w-5 text-center text-xs font-black ${f.rank === 1 ? 'text-gold' : f.rank === 2 ? 'text-gray-400' : f.rank === 3 ? 'text-amber-600' : 'text-white/30'}`}>
              {f.rank}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-bold mb-1 ${f.rank === 1 ? 'text-gold' : 'text-white'}`}>{f.name}</div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full" style={{ width: `${f.pct}%`, background: f.rank === 1 ? 'linear-gradient(to right, #C9A227, #f0d060)' : 'linear-gradient(to right, #4a6fa5, #7eb8f7)' }} />
              </div>
            </div>
            <div className={`text-xs font-black w-9 text-right ${f.rank === 1 ? 'text-gold' : 'text-white/60'}`}>{f.pct}%</div>
          </div>
        ))}
      </div>
    </div>,
  ]

  return (
    <div className={`min-h-screen flex flex-col items-center justify-between py-10 px-6 ${fadingOut ? 'content-fade-out' : 'content-fade-in'}`}>

      {/* Top */}
      <div className="w-full flex flex-col items-center">
        <div className="flex items-center gap-3 pb-5 w-full justify-center" style={{ borderBottom: '1.5px solid rgba(201,162,39,0.6)' }}>
          <Image src="/gctu-crest.png" alt="GCTU" width={48} height={48} className="object-contain" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}  loading="eager" priority />
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wide">Ghana Communication<br />Technology University</div>
            <div className="text-[0.65rem] text-gold italic mt-0.5">Knowledge Comes from Learning</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <span className="w-2 h-2 rounded-full bg-green-400 live-dot" />
          Election is Live
        </div>
      </div>

      {/* Carousel */}
      <div className="flex-1 w-full flex flex-col items-center justify-center">
        <div className="w-full overflow-hidden">
          <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {slides.map((s, i) => (
              <div key={i} className="min-w-full">{s}</div>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 mt-3">
          {[0,1,2].map(i => (
            <button key={i} onClick={() => goToSlide(i)} className={`w-2 h-2 rounded-full transition-all duration-300 ${slide === i ? 'bg-gold scale-125' : 'bg-white/30'}`} />
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="w-full flex flex-col items-center gap-3 max-w-xs">
        <div className="flex items-center gap-1.5 text-xs text-white/55 font-semibold">
          <span className="text-green-400">🔒</span> Your vote is 100% anonymous &amp; encrypted
        </div>
        <button
          onClick={() => navigateTo('/login')}
          className="w-full py-4 rounded-xl text-white font-black text-base uppercase tracking-wider btn-shimmer relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 gold-pulse"
          style={{ background: '#1B2A5E', border: '2px solid rgba(201,162,39,0.4)' }}
        >
          ✓ Sign In to Vote
        </button>
        <button
          onClick={() => navigateTo('/register')}
          className="w-full py-3.5 rounded-xl text-white font-bold text-base transition-all duration-200 hover:bg-white/20 hover:-translate-y-0.5"
          style={{ background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.5)' }}
        >
          Create Account
        </button>
        <p className="text-[0.68rem] text-white/30 text-center leading-relaxed">
          Powered by <span className="text-gold font-semibold">GT-Vote</span> — A secure e-voting system by GCTU IT Students<br />
          © 2025 Ghana Communication Technology University
        </p>
      </div>

    </div>
  )
}
