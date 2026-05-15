'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FiPlus, FiMinus, FiMapPin, FiDollarSign, FiCalendar, FiClock, FiLoader, FiCheck, FiArrowLeft } from 'react-icons/fi'
import { DISTRICTS } from '@/lib/districts'
import { getProvinceFromDistrict } from '@/lib/provinces'

export default function PostTaskPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    budget: '',
    budgetType: 'fixed',
    urgency: 'medium',
    district: '',
    address: '',
    isRemote: false,
    startDate: '',
    preferredTime: '',
    isFlexibleDate: true,
  })

  useEffect(() => {
    checkAuth()
    fetchCategories()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (!data.user || data.user.role !== 'CUSTOMER') {
        router.push('/auth/login')
        return
      }
      setUser(data.user)
    } catch {
      router.push('/auth/login')
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        setCategories(await res.json())
      }
    } catch {}
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    try {
      const body = {
        title: formData.title,
        description: formData.description,
        categoryId: formData.categoryId || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        budgetType: formData.budgetType,
        urgency: formData.urgency,
        district: formData.district,
        province: formData.district ? getProvinceFromDistrict(formData.district) : '',
        address: formData.address || null,
        isRemote: formData.isRemote,
        startDate: formData.startDate || null,
        preferredTime: formData.preferredTime || null,
        isFlexibleDate: formData.isFlexibleDate,
      }

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create task')
        return
      }

      router.push(`/customer/tasks/${data.data.id}?success=true`)
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.title.length >= 3 && formData.description.length >= 10
      case 2:
        return !!formData.district
      case 3:
        return true
      default:
        return true
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/customer/dashboard" className="text-gray-500 hover:text-gray-700">
              <FiArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Post a Task</h1>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <FiCheck size={14} /> : s}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          {/* Step 1: Task Details */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Task Details</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Task Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g., Need help assembling IKEA furniture"
                  maxLength={100}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.title.length}/100</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none resize-none"
                  rows={5}
                  placeholder="Describe what you need help with. Include details like size, location, any special requirements..."
                  maxLength={2000}
                />
                <p className="text-xs text-gray-500 mt-1">{formData.description.length}/2000</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category (Optional)</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget</label>
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <select
                    value={formData.budgetType}
                    onChange={(e) => setFormData({ ...formData, budgetType: e.target.value })}
                    className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="hourly">Hourly</option>
                    <option value="negotiable">Negotiable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Urgency</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as const).map((urgency) => (
                    <button
                      key={urgency}
                      type="button"
                      onClick={() => setFormData({ ...formData, urgency })}
                      className={`flex-1 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                        formData.urgency === urgency
                          ? urgency === 'urgent' ? 'border-red-500 bg-red-50 text-red-700'
                          : urgency === 'high' ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : urgency === 'medium' ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 bg-gray-50 text-gray-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location & Schedule */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Location & Schedule</h2>

              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl">
                <input
                  type="checkbox"
                  id="isRemote"
                  checked={formData.isRemote}
                  onChange={(e) => setFormData({ ...formData, isRemote: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded"
                />
                <label htmlFor="isRemote" className="text-sm font-medium text-gray-700">
                  This is a remote task (no physical location needed)
                </label>
              </div>

              {!formData.isRemote && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiMapPin className="inline mr-2" />
                      District *
                    </label>
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-white"
                    >
                      <option value="">Select District</option>
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Address (Optional)</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                      placeholder="123 Main Street, Colombo"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  id="flexibleDate"
                  checked={formData.isFlexibleDate}
                  onChange={(e) => setFormData({ ...formData, isFlexibleDate: e.target.checked })}
                  className="w-5 h-5 text-indigo-600 rounded"
                />
                <label htmlFor="flexibleDate" className="text-sm font-medium text-gray-700">
                  I'm flexible with the date
                </label>
              </div>

              {!formData.isFlexibleDate && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiCalendar className="inline mr-2" />
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <FiClock className="inline mr-2" />
                      Preferred Time
                    </label>
                    <input
                      type="time"
                      value={formData.preferredTime}
                      onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>

              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{formData.title}</h3>
                  <p className="text-gray-600 mt-2 whitespace-pre-wrap">{formData.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <span className="text-sm text-gray-500">Category</span>
                    <p className="font-medium">
                      {categories.find(c => c.id === formData.categoryId)?.name || 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Budget</span>
                    <p className="font-medium">
                      {formData.budget ? `LKR ${parseFloat(formData.budget).toLocaleString()} (${formData.budgetType})` : 'Negotiable'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Urgency</span>
                    <p className="font-medium capitalize">{formData.urgency}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Location</span>
                    <p className="font-medium">{formData.isRemote ? 'Remote' : formData.district}</p>
                  </div>
                  {!formData.isFlexibleDate && formData.startDate && (
                    <div>
                      <span className="text-sm text-gray-500">Date</span>
                      <p className="font-medium">
                        {new Date(formData.startDate).toLocaleDateString()}
                        {formData.preferredTime ? ` at ${formData.preferredTime}` : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your task will be reviewed by our team before being published. 
                  This usually takes a few hours. You'll be notified once it's live.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => canProceed() && setStep(step + 1)}
                disabled={!canProceed()}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <FiLoader className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Task'
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
