'use client'
import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Search, CheckSquare } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
 
//type CandidateRow = { name: string; position: string; faculty: string; level: string }

// Add
type CandidateRow = {id: string; name: string ;position: string ;faculty: string ;level: string ;slogan: string }



const POSITION_OPTIONS = ['President', 'Vice President', 'General Secretary', 'Financial Secretary', "Women's Commissioner", 'Sports Officer']
const FILTER_OPTIONS = ['All', ...POSITION_OPTIONS]




export default function AdminCandidatesPage() {
  const { navigateTo, fadingOut } = useNavigate()
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const [formPosition, setFormPosition] = useState('')
  const [formFaculty, setFormFaculty] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [formSlogan, setFormSlogan] = useState('')
  const [toast, setToast] = useState('')

 useEffect(() => {
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') {
      navigateTo('/admin'); return
    }

    const { data } = await supabase
      .from('candidates')
      .select('id, full_name, position, faculty, level, slogan')
      .order('position')

    if (data) {
      setCandidates(data.map(c => ({
        id: c.id,
        name: c.full_name,
        position: c.position,
        faculty: c.faculty ?? '',
        level: c.level ?? '',
        slogan: c.slogan ?? '',
      })))
    }
  }

  load()
}, [])


  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2800) }

  const filtered = candidates.filter(c => {
    const matchFilter = filter === 'All' || c.position === filter
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.position.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  function openAdd() {
    setEditIndex(null)
    setFormName(''); setFormPosition(''); setFormFaculty(''); setFormLevel(''); setFormSlogan('')
    setModalOpen(true)
  }

  function openEdit(i: number) {
  const c = filtered[i]
  setEditIndex(candidates.indexOf(c))
  setFormName(c.name)
  setFormPosition(c.position)
  setFormFaculty(c.faculty)
  setFormLevel(c.level)
  setFormSlogan(c.slogan)
  setModalOpen(true)
}

async function saveCandidate() {
  if (!formName || !formPosition) { showToast('Please fill in name and position'); return }
  const supabase = createClient()

  if (editIndex !== null) {
    // Update existing
    const candidate = candidates[editIndex]
    const { error } = await supabase
      .from('candidates')
      .update({
        full_name: formName,
        position: formPosition,
        faculty: formFaculty,
        level: formLevel,
        slogan: formSlogan,
      })
      .eq('id', candidate.id)

    if (!error) {
      const updated = [...candidates]
      updated[editIndex] = { ...candidate, name: formName, position: formPosition, faculty: formFaculty, level: formLevel, slogan: formSlogan }
      setCandidates(updated)
      showToast('Candidate updated')
    } else {
      showToast('Failed to update candidate')
    }
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('candidates')
      .insert({
        full_name: formName,
        position: formPosition,
        faculty: formFaculty,
        level: formLevel,
        slogan: formSlogan,
      })
      .select()
      .single()

    if (!error && data) {
      setCandidates([...candidates, {
        id: data.id,
        name: data.full_name,
        position: data.position,
        faculty: data.faculty ?? '',
        level: data.level ?? '',
        slogan: data.slogan ?? '',
      }])
      showToast('Candidate added')
    } else {
      showToast('Failed to add candidate')
    }
  }

  setModalOpen(false)
}

  function confirmDelete(i: number) {
    setDeleteIndex(candidates.indexOf(filtered[i]))
    setConfirmOpen(true)
  }
async function doDelete() {
  if (deleteIndex === null) return
  const supabase = createClient()
  const candidate = candidates[deleteIndex]

  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', candidate.id)

  if (!error) {
    setCandidates(candidates.filter((_, i) => i !== deleteIndex))
    showToast('Candidate removed')
  } else {
    showToast('Failed to remove candidate')
  }

  setConfirmOpen(false)
}

  return (
    <>
      <div className={`admin-page${fadingOut ? ' fading-out' : ''}`}>
        <AdminNav />
        <div className="admin-content">

          <div className="admin-page-hdr fade-up-1">
            <h1><CheckSquare size={20} color="#C9A227" className="verify-icon-inline" /> Candidate Manager</h1>
            <p>Add, edit or remove election candidates</p>
          </div>

          {/* Filters + Search + Add */}
          <div className="admin-cand-toolbar fade-up-1">
            <div className="admin-filter-btns hide-scrollbar">
              {FILTER_OPTIONS.map(f => (
                <button key={f} className={`admin-filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            <div className="admin-cand-toolbar-right">
              <div className="admin-search-wrap">
                <Search size={14} className="admin-search-icon" />
                <input className="admin-search-input" placeholder="Search candidates..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button className="admin-add-btn" onClick={openAdd}>
                <Plus size={15} /> Add Candidate
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="admin-table-wrap fade-up-2">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th>Faculty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td><span className="admin-pos-tag">{c.position}</span></td>
                    <td>{c.faculty}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button className="admin-row-btn edit" onClick={() => openEdit(i)}><Edit2 size={13} /></button>
                        <button className="admin-row-btn delete" onClick={() => confirmDelete(i)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Add/Edit Modal */}
      <div className={`admin-modal-overlay${modalOpen ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <div className="admin-modal-box">
          <div className="admin-modal-box-title">{editIndex !== null ? 'Edit Candidate' : 'Add New Candidate'}</div>
          <div className="admin-form-field">
            <label className="admin-form-label">Full Name</label>
            <input className="admin-form-input" placeholder="e.g. Kwame Asante" value={formName} onChange={e => setFormName(e.target.value)} />
          </div>
          <div className="admin-form-field">
            <label className="admin-form-label">Position</label>
            <select className="admin-form-select" value={formPosition} onChange={e => setFormPosition(e.target.value)}>
              <option value="">Select position...</option>
              {POSITION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="admin-form-row">
            <div className="admin-form-field">
              <label className="admin-form-label">Faculty</label>
              <input className="admin-form-input" placeholder="e.g. Faculty of IT" value={formFaculty} onChange={e => setFormFaculty(e.target.value)} />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Level</label>
              <input className="admin-form-input" placeholder="e.g. 400" value={formLevel} onChange={e => setFormLevel(e.target.value)} />
            </div>
          </div>
          <div className="admin-form-field">
            <label className="admin-form-label">Campaign Slogan</label>
            <input className="admin-form-input" placeholder="e.g. A future built on unity" value={formSlogan} onChange={e => setFormSlogan(e.target.value)} />
          </div>
          <div className="admin-form-btns">
            <button className="admin-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="admin-btn-save" onClick={saveCandidate}>
              <CheckSquare size={16} className="verify-icon-inline" /> Save Candidate
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Delete */}
      <div className={`admin-confirm-overlay${confirmOpen ? ' show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setConfirmOpen(false) }}>
        <div className="admin-confirm-box">
          <div className="admin-confirm-icon"><Trash2 size={40} color="#EF4444" /></div>
          <div className="admin-confirm-title">Remove Candidate?</div>
          <div className="admin-confirm-msg">You are about to remove <strong>{deleteIndex !== null ? candidates[deleteIndex]?.name : ''}</strong> from the election. This cannot be undone.</div>
          <div className="admin-confirm-btns">
            <button className="admin-btn-keep" onClick={() => setConfirmOpen(false)}>Keep</button>
            <button className="admin-btn-del" onClick={doDelete}><Trash2 size={14} className="verify-icon-inline" /> Remove</button>
          </div>
        </div>
      </div>

      {toast && <div className="admin-toast show">{toast}</div>}
    </>
  )
}
