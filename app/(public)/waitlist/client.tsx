'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiArrowRight, FiCheck } from 'react-icons/fi'

export default function WaitlistPage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'SEEKER', location: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to join')
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
          <h1 className="text-3xl font-black text-white mb-4">You&apos;re on the list!</h1>
          <p className="text-gray-400 mb-8">We&apos;ll notify you when MaintainEX launches. Welcome to the future of home services.</p>
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

        <h1 className="text-3xl md:text-4xl font-black text-white mb-4">Join the Waitlist</h1>
        <p className="text-gray-400 mb-10">Be the first to know when MaintainEX launches. Early members get priority access.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">I am a</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'SEEKER', label: 'Seeker', desc: 'Need help' },
                { value: 'TASKER', label: 'Tasker', desc: 'Offer help' },
                { value: 'AGENCY', label: 'Agency', desc: 'Team of pros' },
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
            <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Phone (optional)</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-[#15161E] border border-gray-800 text-white text-sm focus:border-amber-500 focus:outline-none transition-colors"
              placeholder="+94 77 123 4567"
            />
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
            {loading ? 'Joining...' : 'Join Waitlist'} <FiArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
