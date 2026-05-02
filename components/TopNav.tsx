'use client'
import { useRouter } from 'next/navigation'
import { useNavigate } from '@/lib/hooks'

interface TopNavProps {
  backTo?: string
  backLabel?: string
  rightContent?: React.ReactNode
  rightLabel?: string
  onRightClick?: () => void
}

export default function TopNav({ backTo, backLabel = '← Dashboard', rightContent, rightLabel, onRightClick }: TopNavProps) {
  const router = useRouter()
  const { navigateTo, fadingOut } = useNavigate()

  return (
    <nav
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: '1.5px solid rgba(201,162,39,0.4)', filter: 'drop-shadow(0 1px 6px rgba(201,162,39,0.5))' }}
    >
      <div className="flex items-center gap-2.5">
        <img
          src="/gctu-crest.png"
          alt="GCTU Crest"
          className="w-9 h-9 object-contain"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.4))' }}
           loading="eager"
        />
        <div className="text-white font-black text-lg">GT<span className="text-gold">-Vote</span></div>
      </div>
      <div className="flex items-center gap-2.5">
        {rightContent}
        {backTo && (
          <button
            onClick={() => navigateTo(backTo)}
            className="text-white/80 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            {backLabel}
          </button>
        )}
        {onRightClick && rightLabel && (
          <button
            onClick={onRightClick}
            className="text-white/70 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            {rightLabel}
          </button>
        )}
      </div>
    </nav>
  )
}
