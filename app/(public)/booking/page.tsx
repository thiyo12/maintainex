'use client'

import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import DistrictSelector from '@/components/ui/DistrictSelector'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { FiCalendar, FiClock, FiUser, FiPhone, FiMail, FiMapPin, FiCheck, FiMessageCircle } from 'react-icons/fi'

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

const services = [
  { id: '1', title: 'Home Cleaning', subServices: ['Sofa Cleaning', 'Deep Cleaning', 'House Washing', 'Carpet Cleaning', 'Mattress Cleaning', 'Kitchen Cleaning', 'Bathroom Cleaning', 'Window Cleaning'] },
  { id: '2', title: 'Industrial Cleaning', subServices: ['Hospital Cleaning', 'School Cleaning', 'Office Cleaning', 'Shop Cleaning', 'Mall Cleaning', 'Warehouse Cleaning', 'Post-Construction Cleaning', 'Factory Cleaning'] },
]

const timeSlots = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'
]

export default function BookingForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [selectedService, setSelectedService] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<BookingFormData>()

  const district = watch('district')

  const onSubmit = async (data: BookingFormData) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
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

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-dark-900 mb-4">Book a Cleaning</h1>
            <p className="text-gray-600">Fill in your details below and we will get back to you shortly.</p>
            
            <a
              href="https://wa.me/94770867609?text=Hi, I would like to book a cleaning service"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
            >
              <FiMessageCircle className="text-xl" />
              Quick Book via WhatsApp
            </a>
          </div>

          <div className="flex items-center justify-center mb-12">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step >= s ? 'bg-primary-500 text-dark-900' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > s ? <FiCheck /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-24 h-1 mx-2 ${step > s ? 'bg-primary-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-dark-900 mb-6">Select Your Service</h2>
                
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Service Category *</label>
                  <select
                    {...register('serviceId', { required: 'Please select a service category' })}
                    className="input-field"
                    value={selectedService}
                    onChange={(e) => {
                      setSelectedService(e.target.value)
                      setValue('serviceId', e.target.value)
                    }}
                  >
                    <option value="">Choose a service category</option>
                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.title}
                      </option>
                    ))}
                  </select>
                  {errors.serviceId && <p className="text-red-500 text-sm mt-1">{errors.serviceId.message}</p>}
                </div>

                {selectedService && (
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Specific Service</label>
                    <select
                      {...register('subService')}
                      className="input-field"
                    >
                      <option value="">Select a specific service (optional)</option>
                      {services.find(s => s.id === selectedService)?.subServices.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Preferred Date *
                    </label>
                    <input
                      type="date"
                      {...register('date', { required: 'Please select a date' })}
                      min={getMinDate()}
                      className="input-field"
                    />
                    {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>}
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">
                      Preferred Time *
                    </label>
                    <select
                      {...register('time', { required: 'Please select a time' })}
                      className="input-field"
                    >
                      <option value="">Choose a time</option>
                      {timeSlots.map((time) => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                    {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time.message}</p>}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full btn-primary"
                  disabled={!selectedService}
                >
                  Continue to Your Details
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-6">
                  <p className="text-primary-800 text-sm font-medium">
                    <strong>Required Information:</strong> Please provide your contact details so we can reach you.
                  </p>
                </div>

                <h2 className="text-2xl font-bold text-dark-900 mb-6">Your Contact Details *</h2>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <FiUser className="inline mr-2" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    {...register('name', { required: 'Your name is required' })}
                    placeholder="Enter your full name"
                    className="input-field"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <FiPhone className="inline mr-2" />
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    {...register('phone', { required: 'Your phone number is required' })}
                    placeholder="077XXXXXXX"
                    className="input-field"
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <FiMail className="inline mr-2" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    {...register('email', { required: 'Your email is required' })}
                    placeholder="your@email.com"
                    className="input-field"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                </div>

                <DistrictSelector
                  value={district || ''}
                  onChange={(value) => {
                    setValue('district', value, { shouldValidate: true })
                  }}
                  error={errors.district?.message}
                  required
                />
                {errors.district && <p className="text-red-500 text-sm mt-1">{errors.district.message}</p>}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 btn-outline"
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
                    className="flex-1 btn-primary"
                  >
                    Continue to Address
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-gray-600 text-sm">
                    <strong>Required:</strong> Provide your address for the service location in {district}.
                  </p>
                </div>

                <h2 className="text-2xl font-bold text-dark-900 mb-6">Address *</h2>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <FiMapPin className="inline mr-2" />
                    Your Address *
                  </label>
                  <textarea
                    {...register('address', { required: 'Please enter your address' })}
                    placeholder="Enter your complete address (house number, street, city)"
                    rows={3}
                    className="input-field resize-none"
                  />
                  {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address.message}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Special Instructions (Optional)</label>
                  <textarea
                    {...register('notes')}
                    rows={3}
                    placeholder="Any special instructions or requirements..."
                    className="input-field resize-none"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Our team will call you to confirm your location and service details before the scheduled date.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 btn-outline"
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 btn-primary"
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
      <Footer />
    </>
  )
}
