'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiCalendar, FiImage } from 'react-icons/fi'
import { getAuthHeader } from '@/lib/auth-client'

interface SeasonalOfferJob {
  id: string
  seasonalOfferId: string
  templateJobId: string
  templateJob: { id: string; name: string }
}

interface SeasonalOffer {
  id: string
  title: string
  description: string | null
  slug: string
  season: string
  country: string
  image: string | null
  badgeText: string | null
  bgColor: string | null
  textColor: string | null
  displayOrder: number
  isActive: boolean
  jobs: SeasonalOfferJob[]
  createdAt: string
}

const SEASONS = ['winter', 'spring', 'summer', 'fall', 'general']
const COUNTRIES = ['LK', 'CA']
const BADGE_PRESETS = ['❄️ Winter', '🌸 Spring', '☀️ Summer', '🍂 Fall', '🏠 Special', '⚡ Deal']

const BG_PRESETS = ['#0EA5E9', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6']

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminSeasonalOffers() {
  const [offers, setOffers] = useState<SeasonalOffer[]>([])
  const [templateJobs, setTemplateJobs] = useState<{ id: string; name: string; categoryName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SeasonalOffer | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    slug: '',
    season: 'general',
    country: 'LK',
    image: '',
    badgeText: '',
    bgColor: '#0EA5E9',
    textColor: '#FFFFFF',
    displayOrder: 0,
    selectedJobIds: [] as string[],
  })

  useEffect(() => {
    fetchOffers()
    fetchTemplateJobs()
  }, [])

  const fetchOffers = async () => {
    try {
      const res = await fetch('/api/seasonal-offers')
      const data = await res.json()
      setOffers(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load offers')
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplateJobs = async () => {
    try {
      const res = await fetch('/api/mobile/service-categories')
      if (!res.ok) return
      const cats = await res.json()
      const jobs: { id: string; name: string; categoryName: string }[] = []
      for (const cat of cats) {
        if (cat.jobs) {
          for (const job of cat.jobs) {
            jobs.push({ id: job.id, name: job.name, categoryName: cat.name })
          }
        }
      }
      setTemplateJobs(jobs)
    } catch {
      // silent
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const toggleJobSelection = (jobId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedJobIds: prev.selectedJobIds.includes(jobId)
        ? prev.selectedJobIds.filter(id => id !== jobId)
        : [...prev.selectedJobIds, jobId],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.slug) {
      toast.error('Title and slug are required')
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const isEdit = !!editing

      let offer: any

      if (isEdit) {
        const res = await fetch(`/api/seasonal-offers/${editing!.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(formData),
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
        offer = await res.json()
      } else {
        const res = await fetch('/api/seasonal-offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(formData),
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed') }
        offer = await res.json()
      }

      if (formData.selectedJobIds.length > 0) {
        const offerId = isEdit ? editing!.id : offer.id
        const linkRes = await fetch(`/api/seasonal-offers/${offerId}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ jobIds: formData.selectedJobIds }),
        })
        if (!linkRes.ok) {
          const err = await linkRes.json()
          throw new Error(err.error || 'Failed to link jobs')
        }
      }

      toast.success(isEdit ? 'Offer updated' : 'Offer created')
      setShowModal(false)
      resetForm()
      fetchOffers()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (offer: SeasonalOffer) => {
    setEditing(offer)
    setFormData({
      title: offer.title,
      description: offer.description || '',
      slug: offer.slug,
      season: offer.season,
      country: offer.country,
      image: offer.image || '',
      badgeText: offer.badgeText || '',
      bgColor: offer.bgColor || '#0EA5E9',
      textColor: offer.textColor || '#FFFFFF',
      displayOrder: offer.displayOrder,
      selectedJobIds: offer.jobs.map(j => j.templateJobId),
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this seasonal offer?')) return
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/seasonal-offers/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders },
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Deleted')
      fetchOffers()
    } catch {
      toast.error('Delete failed')
    }
  }

  const resetForm = () => {
    setEditing(null)
    setFormData({
      title: '',
      description: '',
      slug: '',
      season: 'general',
      country: 'LK',
      image: '',
      badgeText: '',
      bgColor: '#0EA5E9',
      textColor: '#FFFFFF',
      displayOrder: 0,
      selectedJobIds: [],
    })
  }

  const getSeasonEmoji = (season: string) => {
    const map: Record<string, string> = { winter: '❄️', spring: '🌸', summer: '☀️', fall: '🍂', general: '🏠' }
    return map[season] || '📅'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Seasonal Offers</h1>
          <p className="text-gray-600 mt-1 text-sm">Manage seasonal promotional offers by country</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true) }}
          className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <FiPlus size={20} />
          Create Offer
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 text-center">
          <FiCalendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Seasonal Offers</h3>
          <p className="text-gray-500 mb-4">Create your first seasonal offer to promote services.</p>
          <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary">
            Create First Offer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                !offer.isActive ? 'opacity-60' : ''
              }`}
            >
              <div
                className="p-4 flex items-center gap-3"
                style={{ background: offer.bgColor || '#0EA5E9', color: offer.textColor || '#FFFFFF' }}
              >
                <span className="text-3xl">{getSeasonEmoji(offer.season)}</span>
                <div>
                  <h3 className="font-bold truncate">{offer.title}</h3>
                  <span className="text-sm opacity-80">{offer.season} · {offer.country}</span>
                </div>
              </div>
              <div className="p-4">
                {offer.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{offer.description}</p>
                )}
                <div className="flex flex-wrap gap-1 mb-3">
                  {offer.jobs.slice(0, 4).map(j => (
                    <span key={j.id} className="px-2 py-0.5 bg-gray-100 text-xs rounded-full text-gray-600">
                      {j.templateJob.name}
                    </span>
                  ))}
                  {offer.jobs.length > 4 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-xs rounded-full text-gray-400">
                      +{offer.jobs.length - 4}
                    </span>
                  )}
                </div>
                {offer.badgeText && (
                  <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-primary-100 text-primary-700 mb-2">
                    {offer.badgeText}
                  </span>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                  <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                    offer.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {offer.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(offer)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded"
                      title="Edit"
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(offer.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">
                {editing ? 'Edit Seasonal Offer' : 'New Seasonal Offer'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input type="text" name="title" value={formData.title} onChange={handleChange} className="input-field" placeholder="Winter Services" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                  <input type="text" name="slug" value={formData.slug} onChange={handleChange} className="input-field" placeholder="winter-services" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} className="input-field" rows={2} placeholder="Seasonal services and offers..." />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
                  <select name="season" value={formData.season} onChange={handleChange} className="input-field">
                    {SEASONS.map(s => (
                      <option key={s} value={s}>{getSeasonEmoji(s)} {s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select name="country" value={formData.country} onChange={handleChange} className="input-field">
                    <option value="LK">Sri Lanka (LK)</option>
                    <option value="CA">Canada (CA)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input type="number" name="displayOrder" value={formData.displayOrder} onChange={handleChange} className="input-field" min={0} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
                <input type="text" name="image" value={formData.image} onChange={handleChange} className="input-field" placeholder="https://..." />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge Text</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {BADGE_PRESETS.map((badge) => (
                    <button
                      key={badge}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, badgeText: badge }))}
                      className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                        formData.badgeText === badge
                          ? 'bg-gray-900 text-white ring-2 ring-gray-900'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {badge}
                    </button>
                  ))}
                </div>
                <input type="text" name="badgeText" value={formData.badgeText} onChange={handleChange} className="input-field" placeholder="Custom badge text" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {BG_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, bgColor: color }))}
                        className="w-8 h-8 rounded-full border-2 transition-all"
                        style={{
                          backgroundColor: color,
                          borderColor: formData.bgColor === color ? '#1a1a1a' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                  <input type="text" name="bgColor" value={formData.bgColor} onChange={handleChange} className="input-field" placeholder="#0EA5E9" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['#FFFFFF', '#1a1a1a', '#FFC300'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, textColor: color }))}
                        className="w-8 h-8 rounded-full border-2 transition-all"
                        style={{
                          backgroundColor: color,
                          borderColor: formData.textColor === color ? '#1a1a1a' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                  <input type="text" name="textColor" value={formData.textColor} onChange={handleChange} className="input-field" placeholder="#FFFFFF" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Linked Services</label>
                <p className="text-xs text-gray-500 mb-2">Select template jobs to include in this seasonal offer.</p>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {templateJobs.length === 0 && (
                    <p className="p-3 text-sm text-gray-400">No services available.</p>
                  )}
                  {templateJobs.map((job) => (
                    <label
                      key={job.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedJobIds.includes(job.id)}
                        onChange={() => toggleJobSelection(job.id)}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">{job.name}</span>
                        <span className="text-xs text-gray-400 ml-2">{job.categoryName}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <FiSave size={18} />
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
