'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiCheck, FiArrowRight, FiStar, FiMessageCircle, FiArrowLeft, FiPhone, FiMapPin } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'
import { useRegion } from '@/lib/region-context'
import FaqSection from '@/components/services/FaqSection'
import type { FaqItem } from '@/lib/faq'

interface ServiceData {
  id: string
  name: string
  slug: string | null
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
  slug: string | null
  description: string
  price: number | null
  duration: number | null
  image: string | null
  category: {
    name: string
  }
}

export default function ServiceDetailClient({
  service,
  relatedServices,
  region: _region,
  city,
  citySlug,
  faqs,
}: {
  service: ServiceData | null
  relatedServices: RelatedService[]
  region: string
  city?: string
  citySlug?: string
  faqs?: FaqItem[]
}) {
  const router = useRouter()
  const region = useRegion()

  const generateWhatsAppLink = () => {
    if (!service) return '#'
    const message = `Hi, I'm interested in the ${service.name} service. Can you provide more information?`
    return `https://wa.me/${region.whatsapp}?text=${encodeURIComponent(message)}`
  }

  const getAverageRating = (reviews: ServiceData['reviews']) => {
    if (!reviews || reviews.length === 0) return 0
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
    return (sum / reviews.length).toFixed(1)
  }

  const isUploadedImage = (imagePath: string | null) => imagePath?.startsWith('/uploads/')
  const getImageSrc = (imagePath: string | null) => {
    if (!imagePath) return 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200'
    if (isUploadedImage(imagePath)) return getImageUrl(imagePath)
    return imagePath
  }

  if (!service) {
    return (
      <>
        <Header />
        <WhatsAppButton />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">😕</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-4">Service Not Found</h1>
            <p className="text-muted-foreground mb-8">The service you're looking for doesn't exist or has been removed.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/services" className="bg-amber-500 hover:bg-amber-600 text-ink font-bold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 transition-all">
                <FiArrowLeft className="w-5 h-5" />
                View All Services
              </Link>
              <a href={generateWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="border border-border hover:bg-muted text-foreground font-semibold px-6 py-3 rounded-full inline-flex items-center justify-center gap-2 transition-all">
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

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-16">
        {/* Breadcrumb */}
        <div className="bg-background border-b border-border">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3">
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="text-muted-foreground hover:text-amber-600 transition-colors">Home</Link>
              <span className="text-muted-foreground/40">/</span>
              <Link href="/services" className="text-muted-foreground hover:text-amber-600 transition-colors">Services</Link>
              <span className="text-muted-foreground/40">/</span>
              <Link href={`/services/${service.slug}`} className="text-muted-foreground hover:text-amber-600 transition-colors truncate">{service.name}</Link>
              {city && (<><span className="text-muted-foreground/40">/</span><span className="text-foreground font-medium truncate">{city}</span></>)}
            </nav>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative">
          <div className="relative h-64 sm:h-80 md:h-96 lg:h-[500px] overflow-hidden bg-muted">
            {isUploadedImage(service.image) ? (
              <img src={getImageSrc(service.image)} alt={service.name} width="1200" height="675" className="w-full h-full object-cover" />
            ) : (
              <Image src={getImageSrc(service.image)} alt={service.name} fill priority sizes="100vw" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-12">
              <div className="max-w-7xl mx-auto">
                {service.category && (
                  <Link href={`/services?category=${service.category.slug}`} className="inline-block bg-amber-500 text-ink px-4 py-2.5 rounded-full text-sm font-semibold mb-4 hover:bg-amber-400 transition-colors">
                    {service.category.name}
                  </Link>
                )}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.02em] text-white mb-4">{service.name}{city ? <span className="block text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-amber-300 mt-2">in {city}</span> : ''}</h1>
                <div className="flex flex-wrap items-center gap-4 text-white/90">
                  {service.reviews && service.reviews.length > 0 && (
                    <span className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                      <FiStar className="w-5 h-5 text-amber-400 fill-amber-400" />
                      {getAverageRating(service.reviews)} ({service.reviews.length} reviews)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-12 md:py-16 bg-background">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              
              {/* Left Column */}
              <div className="md:col-span-2 lg:col-span-2 space-y-8">
                
                {/* Description */}
                <div className="bg-card rounded-3xl border border-border p-6 sm:p-8">
                  <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-4">About {service?.name}{city ? ` in ${city}` : ''}</h2>
                  <div className="max-w-none">
                    <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-line">
                      {service.description || `Professional ${service.name.toLowerCase()} service tailored to your needs. Our experienced team ensures a thorough and efficient clean every time.`}
                    </p>
                    {city && (
                      <p className="text-muted-foreground text-lg leading-relaxed mt-4">
                        We proudly serve {city} and surrounding areas with reliable, professional {service.name.toLowerCase()} services. Our local team is ready to help you.
                      </p>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="bg-card rounded-3xl border border-border p-6 sm:p-8">
                  <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-6">What's Included in {service?.name}</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      'Professional equipment', 'Trained & verified staff',
                      'Quality guaranteed', 'Eco-friendly products',
                      'Customer satisfaction', 'Post-service inspection'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-soft rounded-full flex items-center justify-center flex-shrink-0">
                          <FiCheck className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="text-foreground font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Available Cities */}
                {!city && (
                  <div className="bg-card rounded-3xl border border-border p-6 sm:p-8">
                    <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-4">Areas Where {service?.name} Is Available</h2>
                    <p className="text-muted-foreground mb-4">
                      We serve the following areas in {region.countryName}. Select your city to book {service.name.toLowerCase()} locally.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {region.districts.map(d => {
                        const slug = d.toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
                        return (
                          <Link
                            key={d}
                            href={`/services/${service.slug}/${slug}`}
                            className="inline-flex items-center gap-1.5 bg-muted hover:bg-amber-soft border border-border hover:border-amber-300 text-muted-foreground hover:text-amber-700 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                          >
                            <FiMapPin className="w-3.5 h-3.5" />
                            {d}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* FAQ Section */}
                {faqs && faqs.length > 0 && (
                  <FaqSection faqs={faqs} serviceName={service?.name} />
                )}

                {/* Reviews */}
                {service.reviews && service.reviews.length > 0 && (
                  <div className="bg-card rounded-3xl border border-border p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground">Customer Reviews for {service?.name}</h2>
                      <div className="flex items-center gap-2 bg-amber-soft px-4 py-2 rounded-full">
                        <FiStar className="w-5 h-5 text-amber-500 fill-amber-500" />
                        <span className="font-bold text-foreground">{getAverageRating(service.reviews)}</span>
                        <span className="text-muted-foreground">({service.reviews.length})</span>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {service.reviews.slice(0, 5).map((review) => (
                        <div key={review.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-amber-soft rounded-full flex items-center justify-center">
                              <span className="text-lg font-bold text-amber-600">
                                {review.customerName?.[0]?.toUpperCase() || 'C'}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{review.customerName || 'Customer'}</p>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <FiStar key={i} className={`w-4 h-4 ${i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-muted'}`} />
                                ))}
                              </div>
                            </div>
                          </div>
                          {review.comment && <p className="text-muted-foreground">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Booking Card */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-3xl border border-border p-6 sm:p-8 sticky top-28">
                  {city && (
                    <div className="flex items-center gap-2 bg-amber-soft border border-amber-200 rounded-xl px-4 py-3 mb-6">
                      <FiMapPin className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <span className="text-amber-800 font-medium">Serving <strong>{city}</strong></span>
                    </div>
                  )}
                  <h3 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-6">Book This Service</h3>
                  
                  <button
                    onClick={() => {
                      localStorage.setItem('selectedService', JSON.stringify({
                        id: service.id, name: service.name, price: service.price, category: service.category?.name
                      }))
                      const districtParam = city ? `&district=${encodeURIComponent(city)}` : ''
                      router.push(`/waitlist`)
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-ink font-bold py-4 px-6 rounded-full transition-all duration-300 glow-amber active:scale-[0.98] text-center text-sm md:text-lg mb-4"
                  >
                    {city ? `Book ${service.name} in ${city}` : 'Book Now'}
                  </button>

                  <a href={generateWhatsAppLink()} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-full transition-all duration-300 active:scale-[0.98] text-sm md:text-lg mb-6"
                  >
                    <FiMessageCircle className="w-6 h-6" />
                    Chat on WhatsApp
                  </a>

                  <a href={`tel:${region.phoneRaw}`}
                    className="flex items-center justify-center gap-3 w-full bg-muted hover:bg-muted/80 text-foreground font-semibold py-4 px-6 rounded-full transition-all duration-300 text-sm md:text-lg mb-6"
                  >
                    <FiPhone className="w-5 h-5" />
                    Call: {region.phone}
                  </a>

                  <div className="border-t border-border pt-6 space-y-4">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span>Free cancellation</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span>Satisfaction guaranteed</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <FiCheck className="w-5 h-5 text-green-500" />
                      <span>24/7 customer support</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Related Services */}
        {relatedServices.length > 0 && (
          <section className="py-12 md:py-16 bg-muted">
            <div className="max-w-7xl mx-auto px-5 sm:px-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-[-0.02em] text-foreground">More {service?.category?.name || 'Services'} You Might Like</h2>
                  <p className="text-muted-foreground mt-2">More services in {service.category?.name}{city ? ` in ${city}` : ''}</p>
                </div>
                <Link href="/services" className="hidden sm:flex items-center gap-2 text-amber-600 font-semibold hover:text-amber-700 transition-colors">
                  View All <FiArrowRight className="w-5 h-5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {relatedServices.map((related) => (
                  <Link key={related.id} href={`/services/${related.slug || related.id}${citySlug ? `/${citySlug}` : ''}`}
                    className="group bg-card border border-border rounded-3xl overflow-hidden transition-all duration-300"
                  >
                    <div className="relative h-40 overflow-hidden bg-muted">
                      {isUploadedImage(related.image) ? (
                        <img src={getImageSrc(related.image)} alt={related.name} width="400" height="300" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <Image src={getImageSrc(related.image)} alt={related.name} fill loading="lazy" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-foreground mb-2 group-hover:text-amber-600 transition-colors line-clamp-1">{related.name}</h3>
                      <p className="text-muted-foreground text-sm line-clamp-2 mb-3">{related.description}</p>
                      <div className="flex items-center justify-end">
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-amber-600 transition-colors flex items-center gap-1">
                          View <FiArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-8 text-center sm:hidden">
                <Link href="/services" className="bg-amber-500 hover:bg-amber-600 text-ink font-bold px-6 py-3 rounded-full inline-flex items-center gap-2 transition-all">
                  View All Services <FiArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="py-16 md:py-20 bg-foreground">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.02em] text-background mb-4">Ready to Book {service?.name}?</h2>
            <p className="text-xl text-background/80 mb-8 max-w-2xl mx-auto">
              Book now and let our professional team handle the cleaning. Easy scheduling, instant confirmation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/waitlist"
                className="bg-amber-500 hover:bg-amber-600 text-ink font-bold px-8 py-4 rounded-full transition-all duration-300 glow-amber active:scale-[0.98] text-lg"
              >
                {city ? `Book ${service.name} in ${city}` : 'Book Now'}
              </Link>
              <a href={generateWhatsAppLink()} target="_blank" rel="noopener noreferrer"
                className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-4 rounded-full transition-all duration-300 active:scale-[0.98] text-lg inline-flex items-center justify-center gap-2"
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
