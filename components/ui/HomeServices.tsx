'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FiTool, FiImage, FiPackage, FiStar, FiCloud, FiZap, FiTrendingUp, FiArrowRight, FiCheck } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'

interface Industry {
  id: string
  name: string
  icon: string | null
  image: string | null
  displayOrder: number
}

interface Service {
  id: string
  title: string
  slug: string
  description: string
  image: string | null
  price: number | null
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image: string | null
  services: Service[]
}

interface HomeServicesProps {
  initialCategories: Category[]
  initialServices: Service[]
}

const iconMap: Record<string, React.ReactNode> = {
  wrench: <FiTool className="w-5 h-5" />,
  image: <FiImage className="w-5 h-5" />,
  package: <FiPackage className="w-5 h-5" />,
  sparkles: <FiStar className="w-5 h-5" />,
  tree: <FiCloud className="w-5 h-5" />,
  plug: <FiZap className="w-5 h-5" />,
  trending: <FiTrendingUp className="w-5 h-5" />,
}

const categoryIcons: Record<string, string> = {
  assembly: '🔧',
  mounting: '🖼️',
  moving: '📦',
  cleaning: '✨',
  outdoor: '🌿',
  repairs: '🔌',
  trending: '🔥',
  pestcontrol: '🪳',
  acservice: '❄️',
  watertank: '💧',
  disinfection: '🦠',
  homecare: '🏠',
}

export default function HomeServices({ initialCategories, initialServices }: HomeServicesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategories[0]?.slug || '')
  const [imgLoading, setImgLoading] = useState<Record<string, boolean>>({})
  const [industries, setIndustries] = useState<Industry[]>([])
  const categories = initialCategories
  const allServices = initialServices

  useEffect(() => {
    fetch('/api/industries')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setIndustries(data)
        }
      })
      .catch(console.error)
  }, [])

  const filteredServices = selectedCategory
    ? allServices.filter(s => categories.find(c => c.slug === selectedCategory)?.services.some(sv => sv.id === s.id))
    : allServices

  const featuredCategory = selectedCategory
    ? categories.find(c => c.slug === selectedCategory)
    : categories[0]

  const featuredServices = featuredCategory?.services || []

  const handleCategoryClick = (category: Category) => {
    const firstSvc = category.services?.[0]
    if (firstSvc) {
      localStorage.setItem('selectedService', JSON.stringify({
        id: firstSvc.id,
        name: firstSvc.title,
        price: firstSvc.price,
        category: category.name,
        categoryId: category.id
      }))
      window.location.href = '/waitlist'
    }
  }

  const handleBookNow = (service: Service) => {
    const categorySlug = featuredCategory?.slug || categories[0]?.slug || ''
    localStorage.setItem('selectedService', JSON.stringify({
      id: service.id,
      name: service.title,
      price: service.price,
      category: featuredCategory?.name || categories[0]?.name
    }))
    localStorage.setItem('bookingCategory', categorySlug)
    window.location.href = '/waitlist'
  }

  return (
    <section id="categories" className="py-24 border-y border-border bg-card/40">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.03em] text-ink">
            Eight categories.
          </h2>
          <p className="text-xl text-muted-foreground mt-2">
            Thousands of small wins.
          </p>
        </div>

        {/* Category Pills */}
        <div className="w-full overflow-x-auto pb-4 mb-10">
          <div className="flex gap-2 min-w-max px-2 justify-start md:justify-center">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.slug)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                  selectedCategory === category.slug
                    ? 'bg-amber-500 text-ink shadow-sm'
                    : 'bg-background text-muted-foreground hover:text-foreground border border-border hover:border-amber-300'
                }`}
              >
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Service Card */}
        {selectedCategory && featuredServices.length > 0 && (
          <div className="bg-card rounded-3xl overflow-hidden border border-border mb-10 transition-shadow hover:shadow-sm">
            <div className="flex flex-col md:flex-row">
              <div className="relative h-48 md:h-auto md:w-1/2 min-h-[200px]">
                {featuredServices[0]?.image?.startsWith('/uploads/') ? (
                  <img
                    src={getImageUrl(featuredServices[0]?.image)}
                    alt={featuredCategory?.name || 'Featured service'}
                    width="800"
                    height="450"
                    className="w-full h-full object-cover"
                    onLoad={() => setImgLoading(prev => ({ ...prev, featured: false }))}
                    onError={() => setImgLoading(prev => ({ ...prev, featured: false }))}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Image
                    src={featuredServices[0]?.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800'}
                    alt={featuredCategory?.name || 'Featured service'}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="w-full h-full object-cover"
                    onLoad={() => setImgLoading(prev => ({ ...prev, featured: false }))}
                    onError={() => setImgLoading(prev => ({ ...prev, featured: false }))}
                  />
                )}
                {imgLoading.featured !== false && (
                  <div className="absolute inset-0 bg-muted animate-pulse" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium text-ink">
                    <FiCheck className="w-4 h-4 text-emerald-500" />
                    Popular
                  </span>
                </div>
              </div>

              <div className="p-6 lg:p-8 md:w-1/2 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xl lg:text-2xl font-bold text-ink">
                    {featuredCategory?.name}
                  </h3>
                </div>

                <p className="text-muted-foreground mb-4 text-sm lg:text-base">
                  {featuredCategory?.description || `Professional ${featuredCategory?.name?.toLowerCase()} services.`}
                </p>

                <div className="flex items-center gap-6 mb-5">
                  <div>
                    <div className="text-lg font-bold text-ink">
                      {featuredServices.length} Services
                    </div>
                    <div className="text-xs text-muted-foreground">Available</div>
                  </div>
                  <div className="h-8 w-px bg-border" />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/services/${featuredServices[0]?.slug || ''}`}
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-5 py-2.5 rounded-full transition-colors text-sm"
                  >
                    View Details <FiArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleBookNow(featuredServices[0])}
                    className="inline-flex items-center gap-2 bg-ink hover:opacity-90 text-white font-semibold px-5 py-2.5 rounded-full transition-colors text-sm"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Services Grid */}
        {selectedCategory && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredServices.slice(0, 8).map((service) => (
                <Link
                  key={service.id}
                  href={`/services/${service.slug || service.id}`}
                  className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-amber-300 transition-all duration-300"
                >
                  <div className="relative h-28 md:h-32 overflow-hidden">
                    {service.image?.startsWith('/uploads/') ? (
                    <img
                      src={getImageUrl(service.image)}
                      alt={service.title}
                      width="400"
                      height="250"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Image
                      src={service.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'}
                      alt={service.title}
                      fill
                      loading="lazy"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                </div>

                <div className="p-3 md:p-4">
                  <h4 className="font-bold text-ink text-sm md:text-base mb-1 line-clamp-1 group-hover:text-amber-600 transition-colors">
                    {service.title}
                  </h4>
                  
                  <p className="text-muted-foreground text-xs mb-3 line-clamp-2 hidden md:block">
                    {service.description}
                  </p>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={(e) => { e.preventDefault(); handleBookNow(service); }}
                      className="text-xs font-semibold text-ink bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-full transition-colors"
                    >
                      Book
                    </button>
                  </div>
                </div>
              </Link>
            ))}
            </div>
          </>
        )}

        {/* View All Services */}
        <div className="text-center mt-10">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 text-foreground font-medium px-6 py-2.5 rounded-full border border-border hover:border-amber-300 text-sm transition-all"
          >
            View All Services
            <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Industries We Serve */}
        <div className="mt-20">
          <div className="text-center mb-8">
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-600 font-semibold">Industries</span>
            <h2 className="text-2xl md:text-3xl font-bold text-ink mt-2">
              We serve every industry
            </h2>
          </div>
          
          <div className="relative overflow-hidden w-full">
            <div className="flex animate-scroll gap-4 md:gap-6 w-max justify-start">
              {industries.length > 0 ? (
                <>
                  {industries.map((industry) => (
                    <div key={industry.id} className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border hover:border-amber-300 transition-colors">
                      <div className="h-24 md:h-28 overflow-hidden bg-muted">
                        {industry.image && industry.image.length > 10 ? (
                          <img
                            src={getImageUrl(industry.image)}
                            alt={industry.name}
                            width="320"
                            height="200"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-amber-soft flex items-center justify-center">
                            <span className="text-3xl">{industry.icon || '🏢'}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <h4 className="font-semibold text-ink text-sm">{industry.name}</h4>
                      </div>
                    </div>
                  ))}
                  {industries.map((industry) => (
                    <div key={`${industry.id}-dup`} className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border hover:border-amber-300 transition-colors">
                      <div className="h-24 md:h-28 overflow-hidden bg-muted">
                        {industry.image && industry.image.length > 10 ? (
                          <img
                            src={getImageUrl(industry.image)}
                            alt={industry.name}
                            width="320"
                            height="200"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-amber-soft flex items-center justify-center">
                            <span className="text-3xl">{industry.icon || '🏢'}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <h4 className="font-semibold text-ink text-sm">{industry.name}</h4>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                /* Fallback when no industries data */
                <>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏬</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Shopping Malls</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏫</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Schools</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏠</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Real Estate</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏥</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Hospitals</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏭</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Industrial</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏢</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Office</h4>
                    </div>
                  </div>
                  {/* Duplicates */}
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏬</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Shopping Malls</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏫</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Schools</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏠</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Real Estate</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏥</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Hospitals</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏭</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Industrial</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-card rounded-2xl overflow-hidden border border-border">
                    <div className="h-24 md:h-28 bg-amber-soft flex items-center justify-center">
                      <span className="text-3xl">🏢</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-ink text-sm">Office</h4>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Partner Section */}
          <div className="text-center mt-12">
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-600 font-semibold">Our Partner</span>
            <h3 className="text-xl font-bold text-ink mt-2">MX Cleaning Solution</h3>
            <p className="text-muted-foreground text-sm mt-1">Reliable cleaning partner committed to excellence</p>
          </div>
        </div>
      </div>
    </section>
  )
}
