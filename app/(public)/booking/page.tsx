'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import DistrictSelector from '@/components/ui/DistrictSelector'
import { useState, useEffect, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiCalendar, FiClock, FiUser, FiPhone, FiMail, FiMapPin, FiCheck, FiMessageCircle, FiArrowLeft } from 'react-icons/fi'
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

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<BookingFormData>()

  const district = watch('district')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')

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
      .catch(error => {
        console.error('Error loading services:', error)
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

      toast.success('Booking submitted successfully! We will contact you shortly.')
      router.push('/booking/confirmation')
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.')
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
    ? `Rs. ${selectedService.price.toLocaleString()}+` 
    : 'Contact for quote'

  return (
    <main className="pt-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          {serviceFromUrl && (
            <Link href="/services" className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4">
              <FiArrowLeft className="w-4 h-4" />
              Back to Services
            </Link>
          )}
          <h1 className="text-4xl font-bold text-dark-900 mb-4">Book a Service</h1>
          <p className="text-gray-600">Fill in your details below and we will get back to you shortly.</p>
          
          <a
            href="https://wa.me/94770867609?text=Hi, I would like to book a service"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
          >
            <FiMessageCircle className="text-xl" />
            Quick Book via WhatsApp
          </a>
        </div>

        {selectedService && (
          <div className="bg-gradient-to-r from-primary-500 to-primary-400 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-dark-900">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <img
                src={selectedService.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=200'}
                alt={selectedService.title}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0"
              />
              <div className="text-center sm:text-left flex-1 w-full">
                <h3 className="font-bold text-base sm:text-lg">{selectedService.title}</h3>
                <p className="text-dark-900/70 text-xs sm:text-sm line-clamp-2">{selectedService.description}</p>
              </div>
              <div className="text-center sm:text-right flex-shrink-0">
                <div className="font-bold text-lg sm:text-xl">{priceDisplay}</div>
                {selectedService.duration && (
                  <div className="text-xs sm:text-sm text-dark-900/70">{selectedService.duration} min</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-lg">
          <h3 className="font-semibold text-dark-900 mb-4 text-sm sm:text-base flex items-center gap-2">
            <FiCalendar className="text-primary-500" />
            Preferred Date & Time
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-xs sm:text-sm">
                Select Date *
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={getMinDate()}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-gray-700 font-medium mb-2 text-xs sm:text-sm">
                Select Time *
              </label>
              <select
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Choose a time</option>
                {timeSlots.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center mb-4 sm:mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${
                  step >= s ? 'bg-primary-500 text-dark-900' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s ? <FiCheck /> : s}
              </div>
              {s < 3 && (
                <div className={`w-12 sm:w-24 h-1 mx-1 sm:mx-2 ${step > s ? 'bg-primary-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-4 sm:p-6 md:p-10 lg:p-12">
          {step === 1 && (
            <div className="space-y-5 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4 sm:mb-6">Select Your Service</h2>
              
              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Service *</label>
                <select
                  {...register('serviceId', { required: 'Please select a service' })}
                  className="input-field text-sm sm:text-base"
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
                          {service.title} {service.price ? `- Rs. ${service.price.toLocaleString()}+` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.serviceId && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.serviceId.message}</p>}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!selectedService) {
                    toast.error('Please select a service')
                    return
                  }
                  if (!selectedDate) {
                    toast.error('Please select a date')
                    return
                  }
                  if (!selectedTime) {
                    toast.error('Please select a time')
                    return
                  }
                  setStep(2)
                }}
                className="w-full btn-primary text-sm sm:text-base py-3 sm:py-4"
                disabled={!selectedService || !selectedDate || !selectedTime}
              >
                Continue to Your Details
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 sm:space-y-6">
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                <p className="text-primary-800 text-xs sm:text-sm font-medium">
                  <strong>Required:</strong> Please provide your contact details so we can reach you.
                </p>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4 sm:mb-6">Your Contact Details</h2>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiUser className="inline mr-2" />
                  Full Name (English letters only) *
                </label>
                <input
                  type="text"
                  {...register('name', { 
                    required: 'Your name is required',
                    pattern: {
                      value: /^[a-zA-Z\s]+$/,
                      message: 'Please enter only English letters'
                    },
                    minLength: {
                      value: 2,
                      message: 'Name must be at least 2 characters'
                    }
                  })}
                  placeholder="Enter your full name (e.g., John Smith)"
                  className="input-field text-sm sm:text-base"
                />
                {errors.name && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiPhone className="inline mr-2" />
                  Phone Number (10 digits) *
                </label>
                <input
                  type="tel"
                  {...register('phone', { 
                    required: 'Your phone number is required',
                    pattern: {
                      value: /^\d{10}$/,
                      message: 'Please enter exactly 10 digits'
                    }
                  })}
                  placeholder="0771234567"
                  maxLength={10}
                  className="input-field text-sm sm:text-base"
                />
                {errors.phone && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.phone.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiMail className="inline mr-2" />
                  Email Address *
                </label>
                <input
                  type="email"
                  {...register('email', { required: 'Your email is required' })}
                  placeholder="your@email.com"
                  className="input-field text-sm sm:text-base"
                />
                {errors.email && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.email.message}</p>}
              </div>

              <DistrictSelector
                value={district || ''}
                onChange={(value) => {
                  setValue('district', value, { shouldValidate: true })
                }}
                error={errors.district?.message}
                required
              />
              {errors.district && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.district.message}</p>}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 btn-outline text-sm sm:text-base py-3"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!district) {
                      toast.error('Please select your district')
                      return
                    }
                    setStep(3)
                  }}
                  className="flex-1 btn-primary text-sm sm:text-base py-3"
                >
                  Continue to Address
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 sm:space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
                <p className="text-gray-600 text-xs sm:text-sm">
                  <strong>Required:</strong> Provide your address for the service location in {district}.
                </p>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-dark-900 mb-4 sm:mb-6">Address</h2>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">
                  <FiMapPin className="inline mr-2" />
                  Your Address *
                </label>
                <textarea
                  {...register('address', { required: 'Please enter your address' })}
                  placeholder="Enter your complete address (house number, street, city)"
                  rows={3}
                  className="input-field resize-none text-sm sm:text-base"
                />
                {errors.address && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.address.message}</p>}
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Special Instructions (Optional)</label>
                <textarea
                  {...register('notes')}
                  rows={2}
                  placeholder="Any special instructions or requirements..."
                  className="input-field resize-none text-sm sm:text-base"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-blue-800">
                  <strong>Note:</strong> Our team will call you to confirm your location and service details before the scheduled date.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 btn-outline text-sm sm:text-base py-3"
                  disabled={isSubmitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary text-sm sm:text-base py-3"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          )}
        </form>
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
