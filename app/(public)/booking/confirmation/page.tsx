'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiCheck, FiPhone, FiMessageCircle, FiHome, FiCalendar, FiClock, FiUser, FiMapPin } from 'react-icons/fi'

const WHATSAPP_NUMBER = '94770867609'

interface BookingData {
  name?: string
  phone?: string
  email?: string
  service?: string
  serviceId?: string
  district?: string
  address?: string
  date?: string
  time?: string
  notes?: string
  reference?: string
  category?: string
  price?: number
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationLoading />}>
      <ConfirmationContent />
    </Suspense>
  )
}

function ConfirmationLoading() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      <main className="pt-20 min-h-screen bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading confirmation...</p>
        </div>
      </main>
      <Footer />
    </>
  )
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const [bookingData, setBookingData] = useState<BookingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to get booking data from URL params first
    const getBookingDataFromParams = (): BookingData | null => {
      const ref = searchParams.get('ref')
      const name = searchParams.get('name')
      const phone = searchParams.get('phone')
      const email = searchParams.get('email')
      const service = searchParams.get('service')
      const district = searchParams.get('district')
      const address = searchParams.get('address')
      const date = searchParams.get('date')
      const time = searchParams.get('time')
      const notes = searchParams.get('notes')
      const category = searchParams.get('category')
      const price = searchParams.get('price')

      // If we have at least a reference, we can show confirmation
      if (ref) {
        return {
          reference: ref,
          name: name || undefined,
          phone: phone || undefined,
          email: email || undefined,
          service: service || undefined,
          district: district || undefined,
          address: address || undefined,
          date: date || undefined,
          time: time || undefined,
          notes: notes || undefined,
          category: category || undefined,
          price: price ? parseFloat(price) : undefined
        }
      }
      return null
    }

    // Try to get booking data from localStorage
    const getBookingDataFromStorage = (): BookingData | null => {
      try {
        const stored = localStorage.getItem('lastBookingConfirmation')
        if (stored) {
          return JSON.parse(stored)
        }
      } catch (err) {
        console.error('Error reading from localStorage:', err)
      }
      return null
    }

    // Try URL params first, then localStorage
    let data = getBookingDataFromParams()
    if (!data) {
      data = getBookingDataFromStorage()
    }

    if (data) {
      setBookingData(data)
      // Clear localStorage after reading
      try {
        localStorage.removeItem('lastBookingConfirmation')
      } catch (err) {
        console.error('Error clearing localStorage:', err)
      }
    }

    setLoading(false)
  }, [searchParams])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const generateWhatsAppMessage = () => {
    if (!bookingData) return ''
    
    const service = bookingData.service || 'cleaning service'
    const date = bookingData.date ? formatDate(bookingData.date) : 'the requested date'
    const ref = bookingData.reference || 'N/A'
    
    return `Hi Maintain! I've just submitted a booking for ${service} on ${date}. Reference: ${ref}`
  }

  const handleWhatsAppClick = () => {
    const message = generateWhatsAppMessage()
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleCallClick = () => {
    window.location.href = `tel:${WHATSAPP_NUMBER.replace('94', '0')}`
  }

  if (loading) {
    return <ConfirmationLoading />
  }

  if (!bookingData) {
    return (
      <>
        <Header />
        <WhatsAppButton />
        <main className="pt-20 min-h-screen bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiHome className="text-5xl text-primary-600" />
            </div>
            <h2 className="text-3xl font-bold text-dark-900 mb-4">No Booking Found</h2>
            <p className="text-gray-600 mb-8">
              We couldn&apos;t find any booking confirmation data. This may happen if you navigated here directly.
            </p>
            <Link href="/booking" className="block w-full btn-primary text-center mb-4">
              Make a New Booking
            </Link>
            <Link href="/" className="block w-full text-gray-600 hover:text-dark-900 font-medium py-3">
              <FiHome className="inline mr-2" />
              Back to Home
            </Link>
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
      <main className="pt-20 min-h-screen bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Success Header */}
          <div className="bg-gradient-to-br from-green-400 to-green-600 p-8 text-center">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <FiCheck className="text-5xl text-green-600" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Booking Submitted Successfully!
            </h1>
            <p className="text-white/90 text-lg">
              Thank you for choosing Maintainex
            </p>
          </div>

          {/* Booking Details */}
          <div className="p-6 sm:p-8">
            {/* Reference Number */}
            {bookingData.reference && (
              <div className="bg-primary-50 border-2 border-primary-500 rounded-2xl p-4 mb-6 text-center">
                <p className="text-sm text-primary-600 font-medium mb-1">Booking Reference</p>
                <p className="text-2xl sm:text-3xl font-bold text-dark-900">{bookingData.reference}</p>
              </div>
            )}

            {/* Booking Summary */}
            <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-4">
              <h3 className="font-bold text-dark-900 text-lg mb-3">Booking Summary</h3>
              
              {bookingData.service && (
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiUser className="text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Service</p>
                    <p className="font-semibold text-dark-900">
                      {bookingData.service}
                      {bookingData.category && (
                        <span className="text-gray-500 text-sm ml-2">({bookingData.category})</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {(bookingData.name || bookingData.phone || bookingData.email) && (
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiUser className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Contact Info</p>
                    <p className="font-semibold text-dark-900">{bookingData.name}</p>
                    {bookingData.phone && (
                      <p className="text-gray-600 text-sm">{bookingData.phone}</p>
                    )}
                    {bookingData.email && (
                      <p className="text-gray-600 text-sm">{bookingData.email}</p>
                    )}
                  </div>
                </div>
              )}

              {bookingData.district && (
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiMapPin className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-semibold text-dark-900">{bookingData.district}</p>
                    {bookingData.address && (
                      <p className="text-gray-600 text-sm">{bookingData.address}</p>
                    )}
                  </div>
                </div>
              )}

              {(bookingData.date || bookingData.time) && (
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiCalendar className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Schedule</p>
                    {bookingData.date && (
                      <p className="font-semibold text-dark-900">{formatDate(bookingData.date)}</p>
                    )}
                    {bookingData.time && (
                      <p className="text-gray-600 text-sm flex items-center">
                        <FiClock className="mr-1" />
                        {bookingData.time}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {bookingData.notes && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-dark-900">{bookingData.notes}</p>
                </div>
              )}

              {bookingData.price && (
                <div className="border-t pt-4 flex justify-between items-center">
                  <span className="text-lg font-bold text-dark-900">Total Amount</span>
                  <span className="text-2xl font-bold text-primary-600">
                    Rs. {bookingData.price.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* What Happens Next */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
              <h4 className="font-bold text-blue-900 mb-2">What happens next?</h4>
              <p className="text-blue-800 text-sm">
                Our team will review your booking and call you shortly to confirm the details. 
                Please keep your phone available.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleCallClick}
                className="w-full flex items-center justify-center gap-3 bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold py-4 sm:py-5 rounded-xl transition-all text-lg shadow-lg hover:shadow-xl active:scale-95"
              >
                <FiPhone className="text-xl" />
                Call Us: {WHATSAPP_NUMBER.replace('94', '0')}
              </button>

              <button
                onClick={handleWhatsAppClick}
                className="w-full flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white font-bold py-4 sm:py-5 rounded-xl transition-all text-lg shadow-lg hover:shadow-xl active:scale-95"
              >
                <FiMessageCircle className="text-xl" />
                WhatsApp Us
              </button>

              <Link
                href="/"
                className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-4 sm:py-5 rounded-xl transition-all text-lg"
              >
                <FiHome className="inline mr-2" />
                Back to Home
              </Link>
            </div>

            {/* Additional Help */}
            <div className="mt-6 text-center text-gray-500 text-sm">
              <p>Need help with your booking?</p>
              <p className="mt-1">
                Call us at{' '}
                <a href={`tel:${WHATSAPP_NUMBER.replace('94', '0')}`} className="text-primary-600 font-medium">
                  {WHATSAPP_NUMBER.replace('94', '0')}
                </a>{' '}
                or{' '}
                <button onClick={handleWhatsAppClick} className="text-green-600 font-medium">
                  message on WhatsApp
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
