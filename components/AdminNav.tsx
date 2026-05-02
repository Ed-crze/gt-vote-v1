'use client'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { BarChart2, Users, Settings, Award, LogOut, Home } from 'lucide-react'
import { useNavigate } from '@/lib/hooks'
import { signOut } from '@/lib/auth-client'

export default function AdminNav() {
  const { navigateTo } = useNavigate()
  const path = usePathname()

  const dockItems = [
    { label: 'Dashboard', icon: <BarChart2 size={20} />, href: '/admin/dashboard' },
    { label: 'Candidates', icon: <Award size={20} />, href: '/admin/candidates' },
    { label: 'Voters', icon: <Users size={20} />, href: '/admin/voters' },
    { label: 'Settings', icon: <Settings size={20} />, href: '/admin/settings' },
  ]

  function handleSignOut() {
    sessionStorage.removeItem('admin_auth')
    navigateTo('/admin')
  }
   async function handleStudentPortal() {
    await signOut()
    navigateTo('/login')
  }


  return (
    <>
      {/* Top Nav */}
      <nav className="admin-nav">
        <div className="admin-nav-left">
          <Image src="/gctu-crest.png" alt="GCTU" width={34} height={34} className="admin-nav-crest"  loading="eager" priority/>
          <div className="admin-nav-title">GT<span>-Vote</span></div>
          <div className="admin-nav-badge">
            <span className="admin-nav-dot" />
            Admin
          </div>
        </div>
        <div className="admin-nav-right">
          <button className="admin-nav-btn" onClick={handleStudentPortal}>
            <Home size={13} /> Student Portal
          </button>
          <button className="admin-nav-btn danger" onClick={handleSignOut}>
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </nav>

      {/* Dock */}
      <div className="admin-dock">
        {dockItems.map(item => (
          <button
            key={item.href}
            className={`admin-dock-btn${path === item.href ? ' active' : ''}`}
            onClick={() => navigateTo(item.href)}
          >
            <div className="admin-dock-icon">{item.icon}</div>
            <div className="admin-dock-label">{item.label}</div>
          </button>
        ))}
      </div>
    </>
  )
}
