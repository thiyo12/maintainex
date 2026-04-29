'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FiPlus, FiEdit2, FiTrash2, FiUpload, FiX, FiCheck, FiImage, FiSave, FiGrid } from 'react-icons/fi'
import Image from 'next/image'
import { getImageUrl } from '@/lib/images'

interface Industry {
  id: string
  name: string
  icon: string | null
  image: string | null
  displayOrder: number
  isPartner: boolean
  partnerName: string | null
  isActive: boolean
}

const EMOJI_OPTIONS = ['🏬', '🏫', '🏠', '🏥', '🏭', '📚', '🏢', '🛒', '🏪', '🏨', '🏗️', '🏚️', '🌳', '🌲', '🌴']

export default function AdminIndustries() {
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null)
  const [uploading, setUploading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    icon: '🏬',
    image: '',
    displayOrder: 0,
    isPartner: false,
    partnerName: '',
    isActive: true
  })

  useEffect(() => {
    fetchIndustries()
  }, [])

  const fetchIndustries = async () => {
    try {
      const res = await fetch('/api/industries', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data)) {
        setIndustries(data)
      } else {
        console.error('API error:', data)
        setIndustries([])
      }
    } catch (error) {
      console.error('Error:', error)
      setIndustries([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const authToken = localStorage.getItem('auth_token')
      const res = await fetch('/api/industries', {
        method: editingIndustry ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ...formData,
          id: editingIndustry?.id
        })
      })

      if (res.ok) {
        toast.success(editingIndustry ? 'Industry updated!' : 'Industry created!')
        setShowModal(false)
        fetchIndustries()
        resetForm()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed')
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this industry?')) return

    try {
      const authToken = localStorage.getItem('auth_token')
      const res = await fetch(`/api/industries?id=${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      })
      if (res.ok) {
        toast.success('Industry deleted!')
        fetchIndustries()
      } else {
        toast.error('Failed to delete')
      }
    } catch (error) {
      toast.error('Something went wrong')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      icon: '🏬',
      image: '',
      displayOrder: 0,
      isPartner: false,
      partnerName: '',
      isActive: true
    })
    setEditingIndustry(null)
  }

  const openModal = (industry?: Industry) => {
    if (industry) {
      setEditingIndustry(industry)
      setFormData({
        name: industry.name,
        icon: industry.icon || '🏬',
        image: industry.image || '',
        displayOrder: industry.displayOrder,
        isPartner: industry.isPartner,
        partnerName: industry.partnerName || '',
        isActive: industry.isActive
      })
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const authToken = localStorage.getItem('auth_token')
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
      })
      const data = await res.json()
      
      if (data.url) {
        setFormData(prev => ({ ...prev, image: data.url }))
        toast.success('Image uploaded!')
      }
    } catch (error) {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading && industries.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    )
  }

  if (setupError || industries.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-400 rounded-xl p-6 text-center">
          <h2 className="text-xl font-bold text-dark-900 mb-4">Setup Industries Section</h2>
          <p className="text-gray-600 mb-4">
            The Industries table needs to be created in your database.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Please run: <code className="bg-gray-200 px-2 py-1 rounded">npx prisma db push</code>
            <br />on your server terminal to create the table.
          </p>
          <button
            onClick={async () => {
              setLoading(true)
              setSetupError(null)
              try {
                const authToken = localStorage.getItem('auth_token')
                const res = await fetch('/api/industries/setup', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                  },
                  body: JSON.stringify({ action: 'seed' })
                })
                const data = await res.json()
                if (res.ok) {
                  toast.success(`Created ${data.count} industries!`)
                  fetchIndustries()
                } else {
                  setSetupError(data.error || 'Failed to setup')
                }
              } catch (err: any) {
                setSetupError('Error: ' + (err?.message || 'Unknown error'))
              } finally {
                setLoading(false)
              }
            }}
            className="bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold px-6 py-3 rounded-lg"
          >
            Try Auto-Setup
          </button>
          {setupError && (
            <p className="text-red-600 mt-4">{setupError}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900">Industries We Serve</h1>
          <p className="text-gray-600">Manage industries section for website</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold px-4 py-2 rounded-lg"
        >
          <FiPlus className="w-5 h-5" />
          Add Industry
        </button>
      </div>

      {/* Industries Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {industries.map(industry => (
          <div
            key={industry.id}
            className={`bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
              !industry.isActive ? 'opacity-50' : ''
            }`}
          >
            <div className="h-24 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
              {industry.image ? (
                <Image
                  src={getImageUrl(industry.image)}
                  alt={industry.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="text-4xl">{industry.icon}</span>
              )}
              {industry.isPartner && (
                <div className="absolute top-2 right-2 bg-primary-500 text-dark-900 text-xs font-bold px-2 py-1 rounded">
                  PARTNER
                </div>
              )}
            </div>
            <div className="p-3">
              <h3 className="font-semibold text-dark-900 text-sm truncate">{industry.name}</h3>
              {industry.isPartner && industry.partnerName && (
                <p className="text-xs text-primary-600 truncate">{industry.partnerName}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => openModal(industry)}
                  className="p-1 text-gray-600 hover:text-primary-600"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(industry.id)}
                  className="p-1 text-gray-600 hover:text-red-600"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-dark-900">
                  {editingIndustry ? 'Edit Industry' : 'Add Industry'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                    placeholder="e.g., Shopping Malls"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                        className={`w-10 h-10 text-xl rounded-lg border ${
                          formData.icon === emoji
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image (optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                  {uploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
                  {formData.image && (
                    <div className="mt-2 relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={getImageUrl(formData.image)}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={e => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) }))}
                    className="w-full px-4 py-2 border rounded-lg"
                    min="0"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isPartner"
                    checked={formData.isPartner}
                    onChange={e => setFormData(prev => ({ ...prev, isPartner: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isPartner" className="text-sm font-medium text-gray-700">
                    Mark as Partner
                  </label>
                </div>

                {formData.isPartner && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Partner Name</label>
                    <input
                      type="text"
                      value={formData.partnerName}
                      onChange={e => setFormData(prev => ({ ...prev, partnerName: e.target.value }))}
                      className="w-full px-4 py-2 border rounded-lg"
                      placeholder="e.g., MX Cleaning Solution"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-primary-500 text-dark-900 font-semibold rounded-lg hover:bg-primary-600 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editingIndustry ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}