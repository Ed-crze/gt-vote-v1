'use client'
import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Search, CheckSquare } from 'lucide-react'
import AdminNav from '@/components/AdminNav'
import { useNavigate } from '@/lib/hooks'
import { createClient } from '@/lib/supabase/client'
 
//type CandidateRow = { name: string; position: string; faculty: string; level: string }

// Add
type CandidateRow = {id: string; name: string ;position: string ;faculty: string ;level: string ;slogan: string ;avatar_url:string | null }



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
  const [formPhoto, setFormPhoto] = useState<File | null>(null)
  const [formPhotoPreview, setFormPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

 useEffect(() => {
  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') {
      navigateTo('/admin'); return
    }

  const { data } = await supabase
  .from('candidates')
  .select('id, full_name, position, faculty, level, slogan, avatar_url')
  .order('position')

if (data) {
  setCandidates(data.map(c => ({
    id: c.id,
    name: c.full_name,
    position: c.position,
    faculty: c.faculty ?? '',
    level: c.level ?? '',
    slogan: c.slogan ?? '',
    avatar_url: c.avatar_url ?? null,
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
  setFormName(''); setFormPosition(''); setFormFaculty('')
  setFormLevel(''); setFormSlogan('')
  setFormPhoto(null); setFormPhotoPreview(null)
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
  setFormPhoto(null)
  setFormPhotoPreview(c.avatar_url ?? null)
  setModalOpen(true)
}

async function saveCandidate() {
  if (!formName || !formPosition) {
    showToast('Please fill in name and position')
    return
  }

  const supabase = createClient()
  let avatarUrl: string | null = null

  // Upload photo if one was selected
  if (formPhoto) {
    setUploadingPhoto(true)
    const fileExt = formPhoto.name.split('.').pop()
    const fileName = `${Date.now()}-${formName.replace(/\s+/g, '-').toLowerCase()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('candidate-photos')
      .upload(fileName, formPhoto, { upsert: true })

    if (uploadError) {
      showToast('Failed to upload photo')
      setUploadingPhoto(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('candidate-photos')
      .getPublicUrl(fileName)

    avatarUrl = urlData.publicUrl
    setUploadingPhoto(false)
  }

  if (editIndex !== null) {
    const candidate = candidates[editIndex]
    const updateData: any = {
      full_name: formName,
      position: formPosition,
      faculty: formFaculty,
      level: formLevel,
      slogan: formSlogan,
    }
    // Only update avatar_url if a new photo was uploaded
    if (avatarUrl) updateData.avatar_url = avatarUrl

    const { error } = await supabase
      .from('candidates')
      .update(updateData)
      .eq('id', candidate.id)

    if (!error) {
      const updated = [...candidates]
      updated[editIndex] = {
        ...candidate,
        name: formName,
        position: formPosition,
        faculty: formFaculty,
        level: formLevel,
        slogan: formSlogan,
        avatar_url: avatarUrl ?? candidate.avatar_url,
      }
      setCandidates(updated)
      showToast('Candidate updated')
    } else {
      showToast('Failed to update candidate')
    }
  } else {
    const { data, error } = await supabase
      .from('candidates')
      .insert({
        full_name: formName,
        position: formPosition,
        faculty: formFaculty,
        level: formLevel,
        slogan: formSlogan,
        avatar_url: avatarUrl,
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
        avatar_url: data.avatar_url ?? null,
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

{/* Photo Upload */}
          <div className="admin-form-field">
            <label className="admin-form-label">Candidate Photo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Preview */}
              <div style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                border: '2px dashed rgba(201,162,39,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {formPhotoPreview ? (
                  <img
                    src={formPhotoPreview}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover',objectPosition: 'top center'}}
                  />
                ) : (
                  <span style={{ fontSize: '1.5rem', color: 'rgba(255,255,255,0.2)' }}>📷</span>
                )}
              </div>

              {/* Upload button */}
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'inline-block',
                  padding: '8px 16px',
                  background: 'rgba(201,162,39,0.15)',
                  border: '1px solid rgba(201,162,39,0.3)',
                  borderRadius: '8px',
                  color: '#C9A227',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '6px',
                }}>
                  {formPhotoPreview ? 'Change Photo' : 'Upload Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) {
                        showToast('Photo must be under 2MB')
                        return
                      }
                      setFormPhoto(file)
                      setFormPhotoPreview(URL.createObjectURL(file))
                    }}
                  />
                </label>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                  JPG or PNG, max 2MB. Square photos work best.
                </div>
                {formPhotoPreview && (
                  <button
                    onClick={() => { setFormPhoto(null); setFormPhotoPreview(null) }}
                    style={{
                      background: 'none', border: 'none', color: '#EF4444',
                      fontSize: '0.75rem', cursor: 'pointer', padding: 0, marginTop: '4px',
                    }}
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>
      <div className="admin-form-field">
            <label className="admin-form-label">Campaign Slogan</label>
            <input className="admin-form-input" placeholder="e.g. A future built on unity" value={formSlogan} onChange={e => setFormSlogan(e.target.value)} />
          </div>
          <div className="admin-form-btns">
            <button className="admin-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="admin-btn-save" onClick={saveCandidate} disabled={uploadingPhoto}>
  {uploadingPhoto ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span className="spin" style={{
        display: 'inline-block', width: '14px', height: '14px',
        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%'
      }} />
      Uploading...
    </span>
  ) : (
    <><CheckSquare size={16} className="verify-icon-inline" /> Save Candidate</>
  )}
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
