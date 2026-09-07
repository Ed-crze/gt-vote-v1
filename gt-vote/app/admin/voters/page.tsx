'use client'
import { useState, useEffect } from 'react'
import { Search, Shield, Users } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import { GTV } from '@/lib/store'
import { useNavigate } from '@/lib/hooks'
import type { Student } from '@/lib/types'

const FACULTIES = ['All', 'Faculty of Information Technology', 'Faculty of Engineering', 'Faculty of Computing', 'Faculty of Business', 'Faculty of Applied Sci.']

export default function AdminVotersPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [facultyFilter, setFacultyFilter] = useState('All')
  const [barsReady, setBarsReady] = useState(false)

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (!auth) { navigateTo('/admin'); return }
    setStudents(GTV.getStudents())
    setTimeout(() => setBarsReady(true), 300)
  }, [])

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
    const matchStatus = statusFilter === 'all' || (statusFilter === 'voted' && s.voted) || (statusFilter === 'not-voted' && !s.voted)
    const matchFaculty = facultyFilter === 'All' || s.faculty === facultyFilter
    return matchSearch && matchStatus && matchFaculty
  })

  const voted = students.filter(s => s.voted).length
  const total = students.length
  const turnout = total ? Math.round((voted / total) * 100) : 63

  return (
    <div className={`admin-page${fadingOut ? ' fading-out' : ''}`}>
      <AdminNav />
      <div className="admin-content">

        <div className="admin-page-hdr fade-up-1">
          <h1><Users size={20} color="#C9A227" className="verify-icon-inline" /> Voter Manager</h1>
          <p>Monitor registered students and voting status</p>
        </div>

        {/* Turnout card */}
        <div className="admin-turnout-card fade-up-1">
          <div className="admin-turnout-top">
            <div>
              <div className="admin-turnout-title">Overall Turnout</div>
              <div className="admin-turnout-sub">{voted} of {total || 3248} registered students have voted</div>
            </div>
            <div className="admin-turnout-pct">{turnout}%</div>
          </div>
          <div className="admin-turnout-bar-bg">
            <div className="admin-turnout-bar" style={{ width: barsReady ? `${turnout}%` : '0%' }} />
          </div>
        </div>

        {/* Filters */}
        <div className="admin-voters-toolbar fade-up-2">
          <div className="admin-filter-btns hide-scrollbar">
            {['all', 'voted', 'not-voted'].map(s => (
              <button key={s} className={`admin-filter-btn${statusFilter === s ? ' active' : ''}`} onClick={() => setStatusFilter(s)}>
                {s === 'all' ? 'All' : s === 'voted' ? 'Voted' : 'Not Voted'}
              </button>
            ))}
          </div>
          <div className="admin-voters-toolbar-right">
            <select className="admin-form-select compact" value={facultyFilter} onChange={e => setFacultyFilter(e.target.value)}>
              {FACULTIES.map(f => <option key={f} value={f}>{f === 'All' ? 'All Faculties' : f}</option>)}
            </select>
            <div className="admin-search-wrap">
              <Search size={14} className="admin-search-icon" />
              <input className="admin-search-input" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="admin-table-wrap fade-up-2">
          {filtered.length === 0 ? (
            <div className="admin-empty">No students found</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Student ID</th>
                  <th>Faculty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td><strong>{s.name}</strong></td>
                    <td className="admin-mono">{s.id}</td>
                    <td>{s.faculty}</td>
                    <td>
                      <span className={`admin-status-badge${s.voted ? ' voted' : ' not-voted'}`}>
                        {s.voted ? '✓ Voted' : 'Not Voted'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Privacy Note */}
        <div className="admin-privacy-note fade-up-3">
          <Shield size={18} color="#C9A227" className="verify-icon-inline" />
          <div><strong>Privacy Protected:</strong> This view shows only whether a student has voted — never who they voted for. Ballot choices are stored anonymously with no link to student identity.</div>
        </div>

      </div>
    </div>
  )
}
