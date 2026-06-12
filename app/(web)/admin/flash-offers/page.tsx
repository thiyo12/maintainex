'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiClock, FiSave, FiX, FiCopy } from 'react-icons/fi'
import { getAuthHeader } from '@/lib/auth-client'

interface FlashOffer {
  id: string
  title: string
  description: string | null
  discountType: string
  discountValue: number
  couponCode: string | null
  linkUrl: string | null
  badgeText: string
  bgColor: string
  textColor: string
  startsAt: string
  expiresAt: string
  maxClaims: number
  currentClaims: number
  isActive: boolean
  displayOrder: number
  createdAt: string
}

const BADGE_PRESETS = ['🔥 FLASH', '🎉 NEW', '⚡ DEAL', '⭐ OFFER', '💥 SALE', '🎊 SPECIAL']
const BG_PRESETS = ['#FFC300', '#FF6B6B', '#48BB78', '#4299E1', '#9F7AEA', '#ED8936', '#667EEA']

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AdminFlashOffers() {
  const [offers, setOffers] = useState<FlashOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<FlashOffer | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 0,
    couponCode: '',
    linkUrl: '',
    badgeText: '🔥 FLASH',
    bgColor: '#FFC300',
    textColor: '#1a1a1a',
    startsAt: '',
    expiresAt: '',
    maxClaims: 50,
    displayOrder: 0,
  })

  useEffect(() => {
    fetchOffers()
  }, [])

  const fetchOffers = async () => {
    try {
      const res = await fetch('/api/flash-offers')
      const data = await res.json()
      setOffers(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load offers')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.discountValue || !formData.startsAt || !formData.expiresAt) {
      toast.error('Title, discount value, start and expiry are required')
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const isEdit = !!editing

      const res = await fetch('/api/flash-offers', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(isEdit ? { id: editing.id, ...formData } : formData),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed')
      }

      toast.success(isEdit ? 'Offer updated' : 'Offer created')
      setShowModal(false)
      resetForm()
      fetchOffers()
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const handleEdit = (offer: FlashOffer) => {
    setEditing(offer)
    setFormData({
      title: offer.title,
      description: offer.description || '',
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      couponCode: offer.couponCode || '',
      linkUrl: offer.linkUrl || '',
      badgeText: offer.badgeText,
      bgColor: offer.bgColor,
      textColor: offer.textColor,
      startsAt: new Date(offer.startsAt).toISOString().slice(0, 16),
      expiresAt: new Date(offer.expiresAt).toISOString().slice(0, 16),
      maxClaims: offer.maxClaims,
      displayOrder: offer.displayOrder,
    })
    setShowModal(true)
  }

  const handleToggleActive = async (offer: FlashOffer) => {
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/flash-offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ id: offer.id, isActive: !offer.isActive }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(offer.isActive ? 'Deactivated' : 'Activated')
      fetchOffers()
    } catch {
      toast.error('Failed to toggle status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this offer?')) return
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/flash-offers?id=${id}`, {
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
      discountType: 'PERCENTAGE',
      discountValue: 0,
      couponCode: '',
      linkUrl: '',
      badgeText: '🔥 FLASH',
      bgColor: '#FFC300',
      textColor: '#1a1a1a',
      startsAt: '',
      expiresAt: '',
      maxClaims: 50,
      displayOrder: 0,
    })
  }

  const getTimeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    return `${d}d ${h}h left`
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
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Flash Offers</h1>
          <p className="text-gray-600 mt-1 text-sm">Manage promotional offers on the landing page</p>
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
          <FiClock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Flash Offers</h3>
          <p className="text-gray-500 mb-4">Create your first flash offer to show on the landing page.</p>
          <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary">
            Create First Offer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {offers.map((offer) => {
            const isExpired = new Date(offer.expiresAt).getTime() < Date.now()
            const claimPercent = Math.min((offer.currentClaims / offer.maxClaims) * 100, 100)
            return (
              <div
                key={offer.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                  !offer.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="p-4" style={{ background: offer.bgColor, color: offer.textColor }}>
                  <span className="inline-block text-sm font-bold px-2 py-0.5 rounded bg-black/10">
                    {offer.badgeText}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 truncate">{offer.title}</h3>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-medium text-primary-600">
                      {offer.discountType === 'PERCENTAGE' ? `${offer.discountValue}% OFF` : `LKR ${offer.discountValue} OFF`}
                    </span>
                    {offer.couponCode && (
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                        {offer.couponCode}
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{offer.currentClaims} / {offer.maxClaims} claimed</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${claimPercent}%`,
                          background: claimPercent >= 100 ? '#EF4444' : '#48BB78',
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                    <FiClock size={12} />
                    <span className={isExpired ? 'text-red-500 font-medium' : ''}>
                      {isExpired ? 'Expired' : getTimeLeft(offer.expiresAt)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleToggleActive(offer)}
                        className={`px-2 py-1 text-xs rounded font-medium ${
                          offer.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {offer.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
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
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">
                {editing ? 'Edit Offer' : 'New Offer'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} className="input-field" placeholder="Deep Clean - 25% OFF" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleChange} className="input-field" rows={2} placeholder="One-time offer. Book within the next..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <select name="discountType" value={formData.discountType} onChange={handleChange} className="input-field">
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (LKR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value *</label>
                  <input type="number" name="discountValue" value={formData.discountValue} onChange={handleChange} className="input-field" min={0} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                  <input type="text" name="couponCode" value={formData.couponCode} onChange={handleChange} className="input-field font-mono" placeholder="FLASH25" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input type="number" name="displayOrder" value={formData.displayOrder} onChange={handleChange} className="input-field" min={0} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link URL (CTA button)</label>
                <input type="text" name="linkUrl" value={formData.linkUrl} onChange={handleChange} className="input-field" placeholder="/booking or /services/..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starts At *</label>
                  <input type="datetime-local" name="startsAt" value={formData.startsAt} onChange={handleChange} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expires At *</label>
                  <input type="datetime-local" name="expiresAt" value={formData.expiresAt} onChange={handleChange} className="input-field" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Claims</label>
                <input type="number" name="maxClaims" value={formData.maxClaims} onChange={handleChange} className="input-field" min={1} />
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
                  <input type="text" name="bgColor" value={formData.bgColor} onChange={handleChange} className="input-field" placeholder="#FFC300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {['#1a1a1a', '#FFFFFF', '#FFC300'].map((color) => (
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
                  <input type="text" name="textColor" value={formData.textColor} onChange={handleChange} className="input-field" placeholder="#1a1a1a" />
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
