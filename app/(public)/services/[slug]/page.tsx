'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiClock, FiCheck, FiArrowRight, FiStar, FiMessageCircle, FiArrowLeft, FiPhone } from 'react-icons/fi'

const WHATSAPP_NUMBER = '94770867609'

interface Service {
  id: string
  name: string
  slug: string
  description: string
  price: number | null
  duration: number | null
  image: string | null
  category: {
    id: string
    name: string
    slug: string
  }
  reviews: Array<{
    id: string
    rating: number
    comment: string | null
    customerName: string | null
    createdAt: string
  }>
}

interface RelatedService {
  id: string
  name: string
  slug: string
  description: string
  price: number | null
  duration: number | null
  image: string | null
  category: {
    name: string
  }
}

export default function ServiceDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const [service, setService] = useState<Service | null>(null)
  const [relatedServices, setRelatedServices] = useState<RelatedService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchService = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const res = await fetch(`/api/services/${slug}`)
      
      if (!res.ok) {
        if (res.status === 404) {
          setError('Service not found')
        } else {
          setError('Failed to load service')
        }
        return
      }
      
      const data = await res.json()
      setService(data)
      setRelatedServices(data.relatedServices || [])
    } catch (err) {
      console.error('Error fetching service:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (slug) {
      fetchService()
    }
  }, [slug, fetchService])

  const generateWhatsAppLink = () => {
    if (!service) return '#'
    
    const message = `Hi, I'm interested in the ${service.name} service (Rs. ${service.price?.toLocaleString()}). Can you provide more information?`
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
  }

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return 'Contact for quote'
    return `Rs. ${price.toLocaleString()}`
  }

  const formatDuration = (duration: number | null) => {
    if (!duration) return null
    if (duration >= 60) {
      const hours = Math.floor(duration / 60)
      const mins = duration % 60
      return mins > 0 ? `${hours}h ${mins}min` : `${hours} hour${hours > 1 ? 's' : ''}`
    }
    return `${duration} minutes`
  }

  const getAverageRating = (reviews: Service['reviews']) => {
    if (!reviews || reviews.length === 0) return 0
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
    return (sum / reviews.length).toFixed(1)
  }

  const isUploadedImage = (imagePath: string | null) => imagePath?.startsWith('/uploads/')
  const getImageSrc = (imagePath: string | null) => {
    if (!imagePath) return 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200'
    if (isUploadedImage(imagePath)) return `${imagePath}?t=${Date.now()}`
    return imagePath
  }

  // Loading state
  if (loading) {
    return (
      <>
        <Header />
        <WhatsAppButton />
        <main className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading service details...</p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // Error state
  if (error || !service) {
    return (
      <>
        <Header />
        <WhatsAppButton />
        <main className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">😕</span>
            </div>
            <h1 className="text-2xl font-bold text-dark-900 mb-4">
              {error || 'Service Not Found'}
            </h1>
            <p className="text-gray-600 mb-8">
              The service you're looking for doesn't exist or has been removed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/services"
                className="btn-primary inline-flex items-center justify-center gap-2"
              >
                <FiArrowLeft className="w-5 h-5" />
                View All Services
              </Link>
              <a
                href={generateWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary inline-flex items-center justify-center gap-2"
              >
                <FiMessageCircle className="w-5 h-5" />
                Contact Us
              </a>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // Generate structured data for SEO
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.name,
    description: service.description,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Maintainex',
      telephone: WHATSAPP_NUMBER,
      url: 'https://maintain.lk'
    },
    areaServed: {
      '@type': 'Country',
      name: 'Sri Lanka'
    },
    ...(service.price && {
      offers: {
        '@type': 'Offer',
        price: service.price,
        priceCurrency: 'LKR'
      }
    })
  }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        {/* Breadcrumb */}
        <div className="bg-gray-50 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="text-gray-500 hover:text-primary-600 transition-colors">
                Home
              </Link>
              <span className="text-gray-400">/</span>
              <Link href="/services" className="text-gray-500 hover:text-primary-600 transition-colors">
                Services
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 font-medium truncate">{service.name}</span>
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative">
          <div className="relative h-64 sm:h-80 md:h-96 lg:h-[500px] overflow-hidden bg-gray-200">
            {isUploadedImage(service.image) ? (
              <img
                src={getImageSrc(service.image)}
                alt={service.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={getImageSrc(service.image)}
                alt={service.name}
                fill
                priority
                sizes="100vw"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            
            {/* Service Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12">
              <div className="max-w-7xl mx-auto">
                {service.category && (
                  <Link
                    href={`/services?category=${service.category.slug}`}
                    className="inline-block bg-primary-500 text-dark-900 px-4 py-1.5 rounded-full text-sm font-semibold mb-4 hover:bg-primary-400 transition-colors"
                  >
                    {service.category.name}
                  </Link>
                )}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
                  {service.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-white/90">
                  {service.price !== null && (
                    <span className="text-2xl sm:text-3xl font-bold text-primary-400">
                      {formatPrice(service.price)}
                    </span>
                  )}
                  {service.duration && (
                    <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                      <FiClock className="w-5 h-5" />
                      {formatDuration(service.duration)}
                    </span>
                  )}
                  {service.reviews && service.reviews.length > 0 && (
                    <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                      <FiStar className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      {getAverageRating(service.reviews)} ({service.reviews.length} reviews)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-12 md:py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
              
              {/* Left Column - Description & Details */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* Description */}
                <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
                  <h2 className="text-2xl font-bold text-dark-900 mb-4">About This Service</h2>
                  <div className="prose prose-gray max-w-none">
                    <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">
                      {service.description || 'Professional cleaning service tailored to your needs. Our experienced team ensures a thorough and efficient clean every time.'}
                    </p>
                  </div>
                </div>

                {/* Features/Inclusions */}
                <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
                  <h2 className="text-2xl font-bold text-dark-900 mb-6">What's Included</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      'Professional equipment',
                      'Trained & verified staff',
                      'Quality guaranteed',
                      'Eco-friendly products',
                      'Customer satisfaction',
                      'Post-service inspection'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <FiCheck className="w-5 h-5 text-primary-600" />
                        </div>
                        <span className="text-gray-700 font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reviews Section */}
                {service.reviews && service.reviews.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-dark-900">Customer Reviews</h2>
                      <div className="flex items-center gap-2 bg-primary-50 px-4 py-2 rounded-full">
                        <FiStar className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-bold text-dark-900">{getAverageRating(service.reviews)}</span>
                        <span className="text-gray-500">({service.reviews.length})</span>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {service.reviews.slice(0, 5).map((review) => (
                        <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-lg font-bold text-primary-600">
                                {review.customerName?.[0]?.toUpperCase() || 'C'}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-dark-900">
                                {review.customerName || 'Customer'}
                              </p>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <FiStar
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < review.rating
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-gray-600">{review.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Booking Card */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 sticky top-28">
                  <h3 className="text-2xl font-bold text-dark-900 mb-6">Book This Service</h3>
                  
                  {/* Price Display */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-primary-600">
                        {formatPrice(service.price)}
                      </span>
                      {service.duration && (
                        <span className="text-gray-500">/ {formatDuration(service.duration)}</span>
                      )}
                    </div>
                  </div>

                  {/* Book Now Button - Large Touch Target */}
                  <Link
                    href={`/booking?serviceId=${service.id}`}
                    className="block w-full bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.98] text-center text-lg mb-4"
                  >
                    Book Now
                  </Link>

                  {/* WhatsApp Button - Large Touch Target */}
                  <a
                    href={generateWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.98] text-lg mb-6"
                  >
                    <FiMessageCircle className="w-6 h-6" />
                    Chat on WhatsApp
                  </a>

                  {/* Call Button */}
                  <a
                    href={`tel:${WHATSAPP_NUMBER.replace('94', '0')}`}
                    className="flex items-center justify-center gap-3 w-full bg-gray-100 hover:bg-gray-200 text-dark-900 font-semibold py-4 px-6 rounded-xl transition-all duration-300 text-lg mb-6"
                  >
                    <FiPhone className="w-5 h-5" />
                    Call: {WHATSAPP_NUMBER.replace('94', '0')}
                  </a>

                  {/* Quick Info */}
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <div className="flex items-center gap-3 text-gray-600">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span>Free cancellation</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span>Satisfaction guaranteed</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span>24/7 customer support</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Related Services Section */}
        {relatedServices.length > 0 && (
          <section className="py-12 md:py-16 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-dark-900">Related Services</h2>
                  <p className="text-gray-600 mt-2">More services in {service.category?.name}</p>
                </div>
                <Link
                  href="/services"
                  className="hidden sm:flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700 transition-colors"
                >
                  View All <FiArrowRight className="w-5 h-5" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedServices.map((related) => (
                  <Link
                    key={related.id}
                    href={`/services/${related.slug || related.id}`}
                    className="group bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
                  >
                    <div className="relative h-40 overflow-hidden bg-gray-200">
                      {isUploadedImage(related.image) ? (
                        <img
                          src={getImageSrc(related.image)}
                          alt={related.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <Image
                          src={getImageSrc(related.image)}
                          alt={related.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      )}
                      {related.duration && (
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-700">
                          {formatDuration(related.duration)}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-dark-900 mb-2 group-hover:text-primary-600 transition-colors line-clamp-1">
                        {related.name}
                      </h3>
                      <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                        {related.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-primary-600 font-bold">
                          {formatPrice(related.price)}
                        </span>
                        <span className="text-sm font-medium text-gray-500 group-hover:text-primary-600 transition-colors flex items-center gap-1">
                          View <FiArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-8 text-center sm:hidden">
                <Link
                  href="/services"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  View All Services <FiArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-primary-400 to-primary-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark-900 mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-dark-900/80 mb-8 max-w-2xl mx-auto">
              Book now and let our professional team handle the cleaning. Easy scheduling, instant confirmation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={`/booking?serviceId=${service.id}`}
                className="bg-dark-900 hover:bg-dark-800 text-white font-bold px-8 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.98] text-lg"
              >
                Book Now
              </Link>
              <a
                href={generateWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl active:scale-[0.98] text-lg inline-flex items-center justify-center gap-2"
              >
                <FiMessageCircle className="w-6 h-6" />
                Chat Now
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
