'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiSend, FiCheck, FiUser, FiMail, FiPhone, FiMapPin, FiBriefcase, FiUpload, FiFile } from 'react-icons/fi'
import { DISTRICTS } from '@/lib/districts'

interface Vacancy {
  id: string
  title: string
  description: string | null
  location: string | null
  isActive: boolean
}

export default function CareersPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [cvUrl, setCvUrl] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    district: '',
    address: '',
    experience: ''
  })

  useEffect(() => {
    fetchVacancies()
  }, [])

  const fetchVacancies = async () => {
    try {
      const res = await fetch('/api/vacancies?isActive=true')
      if (res.ok) {
        const data = await res.json()
        setVacancies(data)
      }
    } catch (err) {
      console.error('Error fetching vacancies:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }

    setUploading(true)
    setError('')

    try {
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)

      const res = await fetch('/api/upload/cv', {
        method: 'POST',
        body: uploadFormData
      })

      if (res.ok) {
        const data = await res.json()
        setCvUrl(data.url)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to upload CV')
      }
    } catch (err) {
      setError('Failed to upload CV')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.phone || !formData.position || !formData.district) {
      setError('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cvUrl: cvUrl,
          status: 'PENDING'
        })
      })

      if (res.ok) {
        setSuccess(true)
        setFormData({
          name: '',
          email: '',
          phone: '',
          position: '',
          district: '',
          address: '',
          experience: ''
        })
        setCvUrl('')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to submit application')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <>
        <Header />
        <WhatsAppButton />
        <main className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiCheck className="text-4xl text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-dark-900 mb-4">Application Submitted!</h2>
              <p className="text-gray-600 mb-6">
                Thank you for your interest in joining Maintain. We'll review your application and contact you soon.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold px-6 py-3 rounded-lg transition-all duration-300"
              >
                Submit Another Application
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-400 to-primary-600 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-dark-900 mb-6">
              Join Our Team
            </h1>
            <p className="text-xl text-dark-900/80 max-w-3xl mx-auto">
              Be part of Sri Lanka's leading cleaning service team. We offer great benefits, training, and growth opportunities.
            </p>
          </div>
        </section>

        {/* Open Positions */}
        {!loading && vacancies.length > 0 && (
          <section className="py-12 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold text-dark-900 mb-6 text-center">Open Positions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vacancies.map((vacancy) => (
                  <div key={vacancy.id} className="bg-primary-50 rounded-xl p-5 border border-primary-200">
                    <h3 className="font-bold text-dark-900 mb-2">{vacancy.title}</h3>
                    {vacancy.location && (
                      <p className="text-sm text-gray-600 mb-2">📍 {vacancy.location}</p>
                    )}
                    {vacancy.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{vacancy.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Benefits Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-dark-900 mb-4">Why Work With Us?</h2>
              <p className="text-xl text-gray-600">Great benefits for our amazing team</p>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center p-6 bg-gray-50 rounded-xl">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="font-bold text-dark-900 mb-2">Competitive Pay</h3>
                <p className="text-sm text-gray-600">Above market rates + bonuses</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-xl">
                <div className="text-4xl mb-4">🏥</div>
                <h3 className="font-bold text-dark-900 mb-2">Health Insurance</h3>
                <p className="text-sm text-gray-600">Full medical coverage</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-xl">
                <div className="text-4xl mb-4">📚</div>
                <h3 className="font-bold text-dark-900 mb-2">Training</h3>
                <p className="text-sm text-gray-600">Professional development</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-xl">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="font-bold text-dark-900 mb-2">Work-Life Balance</h3>
                <p className="text-sm text-gray-600">Flexible schedules</p>
              </div>
            </div>
          </div>
        </section>

        {/* Application Form */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-dark-900 mb-4">Apply Now</h2>
              <p className="text-gray-600">Fill out the form below and we'll get back to you soon</p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                        placeholder="Your full name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                        placeholder="0771234567"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position *
                  </label>
                  <div className="relative">
                    <FiBriefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <select
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    >
                      <option value="">Select position</option>
                      {vacancies.map(v => (
                        <option key={v.id} value={v.title}>{v.title}</option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    District *
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <select
                      name="district"
                      value={formData.district}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    >
                      <option value="">Select your district</option>
                      {DISTRICTS.map(district => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Address
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-3 text-gray-400" />
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows={2}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                      placeholder="Your full address"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Experience / Why Join Us?
                  </label>
                  <textarea
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                    placeholder="Tell us about any relevant experience..."
                  />
                </div>

                {/* CV Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload CV (PDF only, max 5MB)
                  </label>
                  <div className={`border-2 border-dashed rounded-lg p-4 ${cvUrl ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                    {cvUrl ? (
                      <div className="flex items-center gap-3 text-green-700">
                        <FiFile className="w-8 h-8" />
                        <span className="font-medium">CV uploaded successfully!</span>
                        <button
                          type="button"
                          onClick={() => setCvUrl('')}
                          className="ml-auto text-red-600 text-sm hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                          id="cv-upload"
                          disabled={uploading}
                        />
                        <label
                          htmlFor="cv-upload"
                          className={`cursor-pointer flex items-center justify-center gap-2 text-primary-600 font-medium ${uploading ? 'opacity-50' : ''}`}
                        >
                          <FiUpload className="w-5 h-5" />
                          {uploading ? 'Uploading...' : 'Click to upload CV (PDF)'}
                        </label>
                        <p className="text-sm text-gray-500 mt-2">PDF files only, max 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold py-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? 'Submitting...' : (
                    <>
                      <FiSend />
                      Submit Application
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-xl font-bold text-dark-900 mb-4">Or contact us directly</h3>
            <p className="text-gray-600 mb-2">📞 0770867609</p>
            <p className="text-gray-600">✉️ careers@maintain.lk</p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}