'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiUser, FiPhone, FiMail, FiMapPin, FiCalendar, FiClock, FiCheck, FiChevronRight, FiChevronLeft, FiMessageCircle } from 'react-icons/fi'
import { DISTRICTS } from '@/lib/districts'

interface Category {
  id: string
  name: string
  slug: string
  serviceCount: number
  services: Service[]
}

interface Service {
  id: string
  title: string
  slug: string
  description: string
  image: string | null
  price: number | null
  duration: number | null
  categoryId: string
}

interface StoredService {
  id: string
  name: string
  price: number
  category?: string
  categoryId?: string
}

interface SelectedCategoryData {
  mainCategory: string
  categoryName: string
}

const WHATSAPP_NUMBER = '94770867609'

const TIME_SLOTS = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
]

export default function BookingPage() {
  return (
    <Suspense fallback={<BookingLoading />}>
      <BookingContent />
    </Suspense>
  )
}

function BookingLoading() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      <main className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
      <Footer />
    </>
  )
}

function BookingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showServiceSelector, setShowServiceSelector] = useState(false)
  const [storedService, setStoredService] = useState<StoredService | null>(null)
  const [selectedCategoryData, setSelectedCategoryData] = useState<SelectedCategoryData | null>(null)
  const [categoryServices, setCategoryServices] = useState<Service[]>([])
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    serviceId: '',
    district: '',
    address: '',
    date: '',
    time: '',
    notes: ''
  })

  useEffect(() => {
    loadStoredData()
    fetchServices()
  }, [])

  const loadStoredData = () => {
    try {
      const stored = localStorage.getItem('selectedService')
      if (stored) {
        const serviceData = JSON.parse(stored) as StoredService
        setStoredService(serviceData)
        setFormData(prev => ({ ...prev, serviceId: serviceData.id }))
        
        if (serviceData.category && serviceData.categoryId) {
          setSelectedCategoryData({
            mainCategory: serviceData.category,
            categoryName: serviceData.category
          })
        }
      }
    } catch (err) {
      console.error('Error reading stored data:', err)
    }
  }
  
  useEffect(() => {
    if (selectedCategoryData && categories.length > 0) {
      const stored = localStorage.getItem('selectedService')
      if (stored) {
        const serviceData = JSON.parse(stored) as StoredService
        const mainCat = categories.find(c => c.services?.some(s => s.id === serviceData.id))
        if (mainCat) {
          setCategoryServices(mainCat.services || [])
        }
      }
    }
  }, [selectedCategoryData, categories])

  useEffect(() => {
    if (step === 2 && !formData.serviceId && categoryServices.length > 0) {
      if (!formData.serviceId) {
        const defaultService = categoryServices[0]
        if (defaultService) {
          setFormData(prev => ({ ...prev, serviceId: defaultService.id }))
          const stored = localStorage.getItem('selectedService')
          if (stored) {
            const s = JSON.parse(stored)
            setStoredService({
              ...s,
              id: defaultService.id,
              name: defaultService.title,
              price: defaultService.price
            })
          }
        }
      }
    }
  })

  useEffect(() => {
    if (step === 2 && !formData.serviceId) {
      setShowServiceSelector(true)
    }
  }, [step])

  useEffect(() => {
    const serviceId = searchParams.get('serviceId')
    const categorySlug = searchParams.get('category')
    if (serviceId) {
      setFormData(prev => ({ ...prev, serviceId }))
    }
    if (categorySlug) {
      const stored = localStorage.getItem('selectedService')
      if (stored) {
        const s = JSON.parse(stored)
        if (s.categoryId) {
          setSelectedCategoryData({
            mainCategory: s.category,
            categoryName: s.category
          })
        }
      }
    }
  }, [searchParams])

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

  const selectedService = categories
    .flatMap(c => c.services || [])
    .find(s => s.id === formData.serviceId)

  const selectedCategory = categories.find(c => 
    c.services?.some(s => s.id === formData.serviceId)
  )

  const displayService = storedService || (selectedService ? {
    id: selectedService.id,
    name: selectedService.title,
    price: selectedService.price
  } : null)
  
  const displayCategory = storedService?.category || selectedCategory?.name || ''

  const handleServiceSelect = (serviceId: string) => {
    setFormData({ ...formData, serviceId })
    setShowServiceSelector(false)
    setStep(2)
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.name.trim().length >= 1 && formData.phone.trim().length >= 9
      case 2:
        return !!formData.district
      case 3:
        return !!formData.date && !!formData.time
      default:
        return true
    }
  }

  const handleNext = () => {
    if (canProceed()) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      if (step === 1 && formData.name.trim().length < 1) {
        alert('Please enter your name')
      } else if (step === 1 && formData.phone.trim().length < 9) {
        alert('Please enter a valid phone number (at least 9 digits)')
      } else if (step === 2 && !formData.district) {
        alert('Please select a district')
      } else if (step === 3 && (!formData.date || !formData.time)) {
        alert('Please select date and time')
      }
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    
    // Debug
    console.log('Submitting booking...', formData)

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData),
        credentials: 'same-origin'
      })

      console.log('Response status:', res.status)

      if (res.ok) {
        const data = await res.json()
        console.log('Response data:', data)
        
        if (data.booking) {
          const bookingData = {
            id: data.booking.id,
            reference: data.booking.id?.slice(-8).toUpperCase() || 'MNT' + Date.now(),
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            service: displayService?.name || formData.serviceId,
            category: displayCategory,
            serviceId: formData.serviceId,
            district: formData.district,
            address: formData.address,
            date: formData.date,
            time: formData.time,
            notes: formData.notes,
            price: displayService?.price || data.booking.totalPrice,
            status: data.booking.status,
            createdAt: data.booking.createdAt
          }
          localStorage.setItem('lastBookingConfirmation', JSON.stringify(bookingData))
          localStorage.removeItem('selectedService')
          
          const confirmUrl = `/booking/confirmation?id=${data.booking.id}`
          window.location.href = confirmUrl
        } else {
          setSuccess(true)
        }
      } else {
        const errorText = await res.text()
        console.log('Error response:', errorText)
        setError(errorText || 'Failed to submit booking')
      }
    } catch (err: any) {
      console.error('Submit error:', err)
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const generateWhatsAppLink = () => {
    const message = `🏠 *NEW BOOKING - Maintain*

👤 *Name:* ${formData.name}
📱 *Phone:* ${formData.phone}
${formData.email ? `✉️ *Email:* ${formData.email}` : ''}

🧹 *Service:* ${displayService?.name || 'Not selected'}
💰 *Price:* Rs. ${displayService?.price?.toLocaleString() || 'TBD'}

📍 *District:* ${formData.district}
${formData.address ? `📍 *Address:* ${formData.address}` : ''}
📅 *Date:* ${formData.date}
⏰ *Time:* ${formData.time}
${formData.notes ? `📝 *Notes:* ${formData.notes}` : ''}

─────────────────────
      Sent from maintainex.lk`

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  if (success) {
    return (
      <>
        <Header />
        <WhatsAppButton />
        <main className="pt-20 min-h-screen bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <FiCheck className="text-5xl text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-dark-900 mb-4">Booking Submitted!</h2>
            <p className="text-gray-600 mb-8">
              Thank you for your booking! We'll call you shortly to confirm.
            </p>
            
            <div className="space-y-4 mb-8">
              <a 
                href={`tel:${WHATSAPP_NUMBER.replace('94', '0')}`}
                className="block w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold py-4 rounded-xl transition-all"
              >
                📞 Call Us: {WHATSAPP_NUMBER.replace('94', '0')}
              </a>
              <a 
                href={generateWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-all"
              >
                💬 Chat on WhatsApp
              </a>
            </div>
            
            <button
              onClick={() => router.push('/')}
              className="w-full text-gray-600 hover:text-dark-900 font-medium py-3"
            >
              ← Back to Home
            </button>
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
      
      <main className="pt-20 min-h-screen bg-gray-50">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary-400 to-primary-600 py-8 px-4">
          <div className="max-w-lg mx-auto text-center">
            <h1 className="text-3xl font-bold text-dark-900 mb-2">Book Your Service</h1>
            <p className="text-dark-900/80">Easy booking in 4 simple steps</p>
          </div>
        </section>

        {/* Progress Bar */}
        <div className="bg-white shadow-sm sticky top-16 z-40">
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    step >= s 
                      ? 'bg-primary-500 text-dark-900' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s ? <FiCheck className="text-lg" /> : s}
                  </div>
                  {s < 4 && (
                    <div className={`w-12 sm:w-16 h-1 mx-1 sm:mx-2 ${
                      step > s ? 'bg-primary-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs sm:text-sm text-gray-500">
              <span className={step >= 1 ? 'text-dark-900 font-medium' : ''}>Your Info</span>
              <span className={step >= 2 ? 'text-dark-900 font-medium' : ''}>Service</span>
              <span className={step >= 3 ? 'text-dark-900 font-medium' : ''}>Schedule</span>
              <span className={step >= 4 ? 'text-dark-900 font-medium' : ''}>Confirm</span>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="max-w-lg mx-auto px-4 py-6">
          
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-dark-900 mb-6">Your Information</h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Name *
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all text-lg"
                      placeholder="Enter your name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all text-lg"
                      placeholder="0771234567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email (Optional)
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all text-lg"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Service Selection */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-dark-900 mb-6">Select Service</h2>
              
              {/* Category Header with all services */}
              {selectedCategoryData && selectedCategoryData.mainCategory && (
                <div className="bg-primary-50 border-2 border-primary-500 rounded-xl p-4 mb-4">
                  <p className="text-lg font-bold text-dark-900 mb-3">
                    {selectedCategoryData.mainCategory}
                  </p>
                  <div className="space-y-2">
                    {preSelectedServices.length > 0 ? (
                      preSelectedServices.map((service: any) => (
                        <button
                          key={service.id}
                          onClick={() => {
                            setFormData({ ...formData, serviceId: service.id })
                            setStoredService({
                              id: service.id,
                              name: service.title,
                              price: service.price,
                              category: selectedCategoryData.categoryName
                            })
                          }}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                            formData.serviceId === service.id
                              ? 'border-primary-500 bg-primary-50' 
                              : 'border-gray-200 hover:border-primary-300'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{service.title}</span>
                            <span className="font-bold text-primary-600">
                              Rs. {service.price?.toLocaleString()}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-gray-500">No services available</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Selected Service Display (when NOT from services page) */}
              {displayService && !selectedCategoryData && (
                    )}
                  </div>
                </div>
              )}
              
              {/* Selected Service Display */}
              {displayService && !selectedCategoryData && (
                <div className="bg-primary-50 border-2 border-primary-500 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      {displayCategory && (
                        <p className="text-sm text-primary-600 font-medium">{displayCategory}</p>
                      )}
                      <p className="text-lg font-bold text-dark-900">{displayService.name}</p>
                      <p className="text-2xl font-bold text-primary-600">Rs. {displayService.price?.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => setShowServiceSelector(true)}
                      className="text-primary-600 font-medium text-sm hover:text-primary-700"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* Service Selector Modal */}
              {showServiceSelector && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
                  <div className="bg-white w-full sm:max-w-lg max-h-[80vh] rounded-t-3xl sm:rounded-2xl overflow-hidden">
                    <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                      <h3 className="text-lg font-bold">Select a Service</h3>
                      <button 
                        onClick={() => setShowServiceSelector(false)}
                        className="text-gray-500 text-2xl"
                      >
                        ×
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-[60vh] p-4 space-y-4">
                      {categories.map(category => (
                        <div key={category.id}>
                          <h4 className="font-bold text-gray-700 mb-2">{category.name}</h4>
                          <div className="space-y-2">
                            {category.services.map(service => (
                              <button
                                key={service.id}
                                onClick={() => handleServiceSelect(service.id)}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                                  formData.serviceId === service.id 
                                    ? 'border-primary-500 bg-primary-50' 
                                    : 'border-gray-200 hover:border-primary-300'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{service.name}</span>
                                  <span className="font-bold text-primary-600">Starting from LKR {service.price?.toLocaleString()}+</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* District */}
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    District *
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all text-lg appearance-none bg-white"
                    >
                      <option value="">Select District</option>
                      {DISTRICTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address (Optional)
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-4 text-gray-400" />
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={3}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all resize-none"
                      placeholder="Enter your address"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-dark-900 mb-6">Schedule</h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Date *
                  </label>
                  <div className="relative">
                    <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all text-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Time *
                  </label>
                  <div className="relative">
                    <FiClock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <select
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all text-lg appearance-none bg-white"
                    >
                      <option value="">Select Time</option>
                      {TIME_SLOTS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-all resize-none"
                    placeholder="Any special requirements..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-dark-900 mb-6">Booking Summary</h2>
              
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6">
                  {error}
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-5 space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name</span>
                  <span className="font-medium">{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone</span>
                  <span className="font-medium">{formData.phone}</span>
                </div>
                {formData.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email</span>
                    <span className="font-medium">{formData.email}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-gray-600">Service</span>
                  <span className="font-bold text-primary-600">{displayService?.name || 'Not selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">District</span>
                  <span className="font-medium">{formData.district}</span>
                </div>
                {formData.address && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address</span>
                    <span className="font-medium text-right max-w-[60%] text-right">{formData.address}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between">
                  <span className="text-gray-600">Date</span>
                  <span className="font-medium">{formatDate(formData.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time</span>
                  <span className="font-medium">{formData.time}</span>
                </div>
                {formData.notes && (
                  <div className="border-t pt-3">
                    <span className="text-gray-600 block mb-1">Notes</span>
                    <span className="font-medium">{formData.notes}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold text-primary-600">
                    Rs. {displayService?.price?.toLocaleString() || 'TBD'}
                  </span>
                </div>
              </div>

              {/* WhatsApp Option */}
              <div className="mb-4">
                <a
                  href={generateWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl transition-all text-lg"
                >
                  <FiMessageCircle className="text-2xl" />
                  Complete via WhatsApp
                </a>
                <p className="text-center text-sm text-gray-500 mt-2">
                  Quick & direct booking via chat
                </p>
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gray-50 text-gray-500">or</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 rounded-xl transition-all"
              >
                <FiChevronLeft />
                Back
              </button>
            )}
            
            {step < 4 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className={`flex-1 flex items-center justify-center gap-2 font-semibold py-4 rounded-xl transition-all ${
                  canProceed()
                    ? 'bg-primary-500 hover:bg-primary-600 text-dark-900'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next
                <FiChevronRight />
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  console.log('Button clicked!')
                  handleSubmit()
                }}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold py-4 rounded-xl transition-all disabled:opacity-50 active:bg-primary-700"
                style={{ touchAction: 'manipulation' }}
              >
                {submitting ? '⏳ Submitting...' : '✅ Submit Booking'}
              </button>
            )}
          </div>

          {/* Help Text */}
          <div className="text-center mt-6 text-gray-500 text-sm space-y-2">
            <p>Need help? <a href={`tel:${WHATSAPP_NUMBER.replace('94', '0')}`} className="text-primary-600 font-medium">Call {WHATSAPP_NUMBER.replace('94', '0')}</a></p>
            <p className="text-xs text-gray-400">or book via WhatsApp</p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
