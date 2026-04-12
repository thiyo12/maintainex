'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import DistrictSelector from '@/components/ui/DistrictSelector'
import { useState, useEffect, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiCalendar, FiClock, FiUser, FiPhone, FiMail, FiMapPin, FiCheck, FiMessageCircle, FiArrowLeft, FiArrowRight } from 'react-icons/fi'
import Link from 'next/link'

interface Service {
  id: string
  title: string
  slug: string
  description: string
  price: number | null
  duration: number | null
  image: string | null
}

interface Category {
  id: string
  name: string
  services: Service[]
}

interface BookingFormData {
  name: string
  phone: string
  email: string
  district: string
  address: string
  serviceId: string
  subService: string
  date: string
  time: string
  notes: string
}

const timeSlots = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'
]

function BookingFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serviceFromUrl, setServiceFromUrl] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [showDateTime, setShowDateTime] = useState(false)

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<BookingFormData>()

  const district = watch('district')

  useEffect(() => {
    const serviceSlug = searchParams.get('service')
    if (serviceSlug) {
      setServiceFromUrl(serviceSlug)
    }

    fetch('/api/categories')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load services')
        return res.json()
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Invalid data format')
        setCategories(data || [])
        const allServices = (data || []).flatMap((c: Category) => c.services || [])
        setServices(allServices)
        
        if (serviceSlug && allServices.length > 0) {
          const found = allServices.find((s: Service) => s.slug === serviceSlug)
          if (found) {
            setSelectedService(found)
            setValue('serviceId', found.id)
          }
        }
      })
      .catch(() => {
        toast.error('Failed to load services. Please refresh the page.')
      })
  }, [searchParams, setValue])

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true)
    try {
      const formData = {
        ...data,
        date: selectedDate,
        time: selectedTime
      }
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit booking')
      }

      toast.success('Booking submitted successfully!')
      router.push('/booking/confirmation')
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const priceDisplay = selectedService?.price 
    ? `Rs. ${selectedService.price.toLocaleString()}` 
    : 'Contact for quote'

  const handleContinueToStep2 = () => {
    if (!selectedService) {
      toast.error('Please select a service')
      return
    }
    setShowDateTime(true)
    setStep(2)
  }

  return (
    <main className="pt-20 pb-12">
      <div className="max-w-lg mx-auto px-4">
        
        {/* Header */}
        <div className="text-center mb-6">
          {serviceFromUrl && (
            <Link href="/services" className="inline-flex items-center gap-1 text-primary-600 text-sm mb-3">
              <FiArrowLeft className="w-4 h-4" />
              Back to Services
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-dark-900">Book a Service</h1>
          <p className="text-gray-600 text-sm mt-1">Fill details below and we will contact you</p>
          
          <a
            href="https://wa.me/94770867609?text=Hi, I would like to book"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium"
          >
            <FiMessageCircle />
            Quick Book via WhatsApp
          </a>
        </div>

        {/* Selected Service Card */}
        {selectedService && (
          <div className="bg-gradient-to-r from-primary-500 to-primary-400 rounded-xl p-4 mb-4 text-dark-900">
            <div className="flex items-center gap-3">
              <img
                src={selectedService.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100'}
                alt={selectedService.title}
                className="w-14 h-14 rounded-lg object-cover"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate">{selectedService.title}</h3>
                <p className="text-xs opacity-70 line-clamp-1">{selectedService.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-bold">{priceDisplay}</div>
                {selectedService.duration && (
                  <div className="text-xs opacity-70">{selectedService.duration} min</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step Indicators */}
        <div className="flex items-center justify-center mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  step >= s ? 'bg-primary-500 text-dark-900' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <FiCheck size={16} /> : s}
              </div>
              {s < 3 && (
                <div className={`w-8 sm:w-16 h-1 mx-1 ${step > s ? 'bg-primary-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Service Selection */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <h2 className="text-lg font-bold text-dark-900 mb-4">1. Select Service</h2>
          
          <div className="mb-4">
            <select
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm bg-white"
              value={selectedService?.id || ''}
              onChange={(e) => {
                const service = services.find(s => s.id === e.target.value)
                setSelectedService(service || null)
                setValue('serviceId', e.target.value)
              }}
            >
              <option value="">Choose a service</option>
              {categories.map((category) => (
                <optgroup key={category.id} label={category.name}>
                  {category.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.title} {service.price ? `- Rs. ${service.price.toLocaleString()}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Date & Time */}
          <div className={`space-y-3 ${showDateTime ? 'block' : 'hidden'}`}>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <FiCalendar className="inline mr-1" /> Select Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                <FiClock className="inline mr-1" /> Select Time *
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm"
              >
                <option value="">Choose time</option>
                {timeSlots.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleContinueToStep2}
            className="w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold py-3 rounded-lg mt-4 flex items-center justify-center gap-2"
          >
            Continue <FiArrowRight />
          </button>
        </div>

        {/* Step 2: Contact Details */}
        {step >= 2 && (
          <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <h2 className="text-lg font-bold text-dark-900 mb-4">2. Your Details</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <FiUser className="inline mr-1" /> Full Name *
                </label>
                <input
                  type="text"
                  {...register('name', { 
                    required: 'Name is required',
                    pattern: {
                      value: /^[a-zA-Z\s]+$/,
                      message: 'English letters only'
                    }
                  })}
                  placeholder="John Smith"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <FiPhone className="inline mr-1" /> Phone (10 digits) *
                </label>
                <input
                  type="tel"
                  {...register('phone', { 
                    required: 'Phone is required',
                    pattern: {
                      value: /^\d{10}$/,
                      message: 'Enter 10 digits'
                    }
                  })}
                  placeholder="0771234567"
                  maxLength={10}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <FiMail className="inline mr-1" /> Email *
                </label>
                <input
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
              </div>

              <DistrictSelector
                value={district || ''}
                onChange={(value) => setValue('district', value, { shouldValidate: true })}
                error={errors.district?.message}
                required
              />
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium text-sm"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!district) {
                    toast.error('Please select district')
                    return
                  }
                  setStep(3)
                }}
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold py-3 rounded-lg"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Address */}
        {step === 3 && (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <h2 className="text-lg font-bold text-dark-900 mb-4">3. Address</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  <FiMapPin className="inline mr-1" /> Address in {district} *
                </label>
                <textarea
                  {...register('address', { required: 'Address is required' })}
                  placeholder="House number, street, city"
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm resize-none"
                />
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  placeholder="Special instructions..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm resize-none"
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 mt-3">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> We will call to confirm your booking before the date.
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium text-sm"
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold py-3 rounded-lg text-sm"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Confirm Booking'}
              </button>
            </div>
          </form>
        )}

        {/* Summary Card */}
        {selectedService && selectedDate && selectedTime && step < 3 && (
          <div className="bg-gray-100 rounded-xl p-4 mt-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">Booking Summary</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Service:</strong> {selectedService.title}</p>
              <p><strong>Date:</strong> {selectedDate}</p>
              <p><strong>Time:</strong> {selectedTime}</p>
              <p><strong>Price:</strong> {priceDisplay}</p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}

export default function BookingForm() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      <Suspense fallback={
        <main className="pt-20">
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </main>
      }>
        <BookingFormContent />
      </Suspense>
      <Footer />
    </>
  )
}
