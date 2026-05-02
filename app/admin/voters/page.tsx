'use client'
import { useState, useEffect } from 'react'
import { Search, Shield, Users } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'

const FACULTIES = ['All', 'Faculty of Information Technology', 'Faculty of Engineering', 'Faculty of Computing', 'Faculty of Business', 'Faculty of Applied Sci.']

type VoterRow = {
  id: string
  name: string
  student_id: string
  faculty: string
  voted: boolean
}

export default function AdminVotersPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [students, setStudents] = useState<VoterRow[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [facultyFilter, setFacultyFilter] = useState('All')
  const [barsReady, setBarsReady] = useState(false)
  const [realVoted, setRealVoted] = useState(0)
  const [realTotal, setRealTotal] = useState(0)

 useEffect(() => {
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') {
      navigateTo('/admin'); return
    }

    // Get all students
    const { data: studentData } = await supabase
      .from('students')
      .select('id, full_name, student_id, faculty')
      .order('full_name')

    // Get all voted hashes
    const { data: registryData } = await supabase
      .from('voter_registry')
      .select('student_id_hash, has_voted')

    if (studentData && registryData) {
      // We can't reverse the hash — so we use the registry count
      // to show voted/not-voted per student using the has_voted flag
      // matched by joining through the registry count
      const votedCount = registryData.filter(r => r.has_voted).length
      const totalCount = studentData.length

      // For individual rows we show voted status from voter_registry
      // We need to hash each student ID to match — instead we track
      // voted count separately and show status as unknown per-student
      // to preserve the Voting Paradox (we cannot link hash to student)
      setStudents(studentData.map(s => ({
        id: s.id,
        name: s.full_name,
        student_id: s.student_id,
        faculty: s.faculty,
        voted: false, // see note below
      })))

      // Override the turnout numbers with real counts
      setRealVoted(votedCount)
      setRealTotal(totalCount)
    }

    setTimeout(() => setBarsReady(true), 300)
  }

  load()
}, [])

 const filtered = students.filter(s => {
  const matchSearch = !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.includes(search)
  const matchStatus = statusFilter === 'all'
  const matchFaculty = facultyFilter === 'All' || s.faculty === facultyFilter
  return matchSearch && matchStatus && matchFaculty
})

 const voted = realVoted
const total = realTotal || students.length
const turnout = total ? Math.round((voted / total) * 100) : 0

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
        {/* Filters */}
        <div className="admin-voters-toolbar fade-up-2">
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
                    <td className="admin-mono">{s.student_id}</td>
                    <td>{s.faculty}</td>
                    <td>
                      <span className="admin-status-badge privacy-protected">
                      🔒 Protected
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

