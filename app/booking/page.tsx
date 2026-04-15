'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiUser, FiPhone, FiMail, FiMapPin, FiCalendar, FiClock, FiCheck } from 'react-icons/fi'

interface Service {
  id: string
  name: string
  price: number
}

interface Category {
  id: string
  name: string
  services: Service[]
}

export default function BookingPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    district: '',
    serviceId: '',
    date: '',
    time: '',
    notes: ''
  })

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (err) {
      console.error('Error fetching services:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setSuccess(true)
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          district: '',
          serviceId: '',
          date: '',
          time: '',
          notes: ''
        })
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to submit booking')
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedService = categories
    .flatMap(c => c.services)
    .find(s => s.id === formData.serviceId)

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
              <h2 className="text-2xl font-bold text-dark-900 mb-4">Booking Submitted!</h2>
              <p className="text-gray-600 mb-6">
                Thank you for your booking! We'll contact you shortly to confirm your appointment.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold px-6 py-3 rounded-lg transition-all duration-300"
              >
                Book Another Service
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
        <section className="bg-gradient-to-br from-primary-400 to-primary-600 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-dark-900 mb-4">
              Book Your Service
            </h1>
            <p className="text-xl text-dark-900/80">
              Easy online booking. Instant confirmation.
            </p>
          </div>
        </section>

        {/* Booking Form */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Info */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name *
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
                        placeholder="Enter your name"
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
                    Email Address
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service *
                  </label>
                  <select
                    name="serviceId"
                    value={formData.serviceId}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  >
                    <option value="">Select a service</option>
                    {loading ? (
                      <option>Loading services...</option>
                    ) : (
                      categories.map(category => (
                        <optgroup key={category.id} label={category.name}>
                          {category.services.map(service => (
                            <option key={service.id} value={service.id}>
                              {service.name} - Rs. {service.price.toLocaleString()}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    )}
                  </select>
                  {selectedService && (
                    <p className="mt-2 text-sm text-primary-600 font-medium">
                      Selected: {selectedService.name} - Rs. {selectedService.price.toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-3 text-gray-400" />
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      rows={3}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                      placeholder="Enter your full address"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    District *
                  </label>
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  >
                    <option value="">Select district</option>
                    <option value="Colombo">Colombo</option>
                    <option value="Gampaha">Gampaha</option>
                    <option value="Kalutara">Kalutara</option>
                    <option value="Kandy">Kandy</option>
                    <option value="Jaffna">Jaffna</option>
                    <option value="Galle">Galle</option>
                    <option value="Matara">Matara</option>
                    <option value="Hambantota">Hambantota</option>
                    <option value="Kurunegala">Kurunegala</option>
                    <option value="Anuradhapura">Anuradhapura</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Date *
                    </label>
                    <div className="relative">
                      <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        required
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Time *
                    </label>
                    <div className="relative">
                      <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <select
                        name="time"
                        value={formData.time}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                      >
                        <option value="">Select time</option>
                        <option value="08:00 AM">08:00 AM</option>
                        <option value="09:00 AM">09:00 AM</option>
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="11:00 AM">11:00 AM</option>
                        <option value="12:00 PM">12:00 PM</option>
                        <option value="01:00 PM">01:00 PM</option>
                        <option value="02:00 PM">02:00 PM</option>
                        <option value="03:00 PM">03:00 PM</option>
                        <option value="04:00 PM">04:00 PM</option>
                        <option value="05:00 PM">05:00 PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all resize-none"
                    placeholder="Any special instructions or requirements..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold py-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Booking'}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Info Section */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="p-6">
                <div className="text-4xl mb-4">📞</div>
                <h3 className="font-bold text-dark-900 mb-2">Call Us</h3>
                <p className="text-gray-600">0770867609</p>
              </div>
              <div className="p-6">
                <div className="text-4xl mb-4">💬</div>
                <h3 className="font-bold text-dark-900 mb-2">WhatsApp</h3>
                <p className="text-gray-600">0770867609</p>
              </div>
              <div className="p-6">
                <div className="text-4xl mb-4">✉️</div>
                <h3 className="font-bold text-dark-900 mb-2">Email</h3>
                <p className="text-gray-600">info@maintain.lk</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
