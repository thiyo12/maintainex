'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FiArrowRight, FiCheck } from 'react-icons/fi'

type SelectedService = {
  name?: string
  category?: string
}

export default function WaitlistPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'SEEKER', location: '', countryCode: '+94' })
  const [selectedService, setSelectedService] = useState<SelectedService | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedRole = params.get('role')?.toUpperCase()
    const normalizedRole = requestedRole === 'COMPANY' ? 'AGENCY' : requestedRole

    if (normalizedRole && ['SEEKER', 'TASKER', 'AGENCY'].includes(normalizedRole)) {
      setForm((current) => ({ ...current, role: normalizedRole }))
    }

    const storedService = window.localStorage.getItem('selectedService')
    if (storedService) {
      try {
        const parsed = JSON.parse(storedService) as SelectedService
        if (parsed?.name) setSelectedService(parsed)
      } catch {
        window.localStorage.removeItem('selectedService')
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const phone = form.countryCode + form.phone.replace(/\s/g, '')
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone,
          role: form.role,
          location: form.location,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to request access')
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0B0C12] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <FiCheck className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-3xl font-black text-white mb-4">Early access requested</h1>
          <p className="text-gray-400 mb-8">
            We&apos;ll use these details to notify you when the MaintainEX mobile release is ready for your role.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 text-amber-500 font-semibold hover:text-amber-400 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B0C12]">
      <div className="max-w-lg mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-12 text-amber-500 hover:text-amber-400 transition-colors">
          ← Back to Home
        </Link>

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500 mb-3">MaintainEX mobile app</p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-4">Get early access</h1>
        <p className="text-gray-400 mb-8">
          Choose how you plan to use MaintainEX. We&apos;ll keep your selected path ready for the public mobile launch.
        </p>

        {selectedService?.name && form.role === 'SEEKER' && (
          <div className="mb-8 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400">Selected service</div>
            <div className="mt-1 font-bold text-white">{selectedService.name}</div>
            {selectedService.category && <div className="mt-1 text-sm text-gray-400">{selectedService.category}</div>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">I am a</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'SEEKER', label: 'Customer', desc: 'Need a service' },
                { value: 'TASKER', label: 'Tasker', desc: 'Offer services' },
                { value: 'AGENCY', label: 'Company', desc: 'Manage a team' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, role: opt.value })}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    form.role === opt.value
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-gray-800 bg-[#15161E] text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="text-sm font-bold">{opt.label}</div>
                  <div className="text-xs mt-1 opacity-60">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#15161E] border border-gray-800 text-white text-sm focus:border-amber-500 focus:outline-none transition-colors"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#15161E] border border-gray-800 text-white text-sm focus:border-amber-500 focus:outline-none transition-colors"
              placeholder="you@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Phone</label>
            <div className="flex gap-2">
              <select
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                className="bg-[#15161E] border border-gray-800 text-white text-sm rounded-xl px-3 py-3 focus:border-amber-500 focus:outline-none transition-colors min-w-[100px]"
              >
                <option value="+94">🇱🇰 +94</option>
                <option value="+1">🇨🇦 +1</option>
              </select>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="flex-1 px-4 py-3 rounded-xl bg-[#15161E] border border-gray-800 text-white text-sm focus:border-amber-500 focus:outline-none transition-colors"
                placeholder="7X XXX XXXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Location (optional)</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#15161E] border border-gray-800 text-white text-sm focus:border-amber-500 focus:outline-none transition-colors"
              placeholder="City, Country"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold px-6 py-4 rounded-xl text-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Requesting...' : 'Request early access'} <FiArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
