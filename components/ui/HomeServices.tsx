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
      window.location.href = `/booking?serviceId=${firstSvc.id}&category=${category.slug}`
    }
  }

  const handleBookNow = (service: Service) => {
    localStorage.setItem('selectedService', JSON.stringify({
      id: service.id,
      name: service.title,
      price: service.price,
      category: featuredCategory?.name
    }))
    window.location.href = `/booking?serviceId=${service.id}`
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Book trusted help for home tasks
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Professional services at your fingertips. From assembly to cleaning, we have you covered.
          </p>
        </div>

        {/* Category Pills - TaskRabbit Style */}
        <div className="w-full overflow-x-auto pb-4 mb-8">
          <div className="flex gap-2 min-w-max px-2 justify-start md:justify-center">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.slug)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all duration-200 whitespace-nowrap text-sm ${
                  selectedCategory === category.slug
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>{categoryIcons[category.slug] || '📋'}</span>
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Service Card - Show only for specific category */}
        {selectedCategory && featuredServices.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-lg mb-8 border border-gray-100">
            <div className="flex flex-col">
              <div className="relative h-48 md:h-56">
                {featuredServices[0]?.image?.startsWith('/uploads/') ? (
                  <img
                    src={getImageUrl(featuredServices[0]?.image)}
                    alt={featuredCategory?.name || 'Featured service'}
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
                  <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium text-gray-800">
                    <FiCheck className="w-4 h-4 text-green-500" />
                    Popular
                  </span>
                </div>
              </div>

              <div className="p-6 lg:p-8 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{categoryIcons[featuredCategory?.slug || ''] || '📋'}</span>
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900">
                    {featuredCategory?.name}
                  </h3>
                </div>

                <p className="text-gray-600 mb-4 text-sm lg:text-base">
                  {featuredCategory?.description || `Professional ${featuredCategory?.name?.toLowerCase()} services.`}
                </p>

                <div className="flex items-center gap-6 mb-5">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {featuredServices.length} Services
                    </div>
                    <div className="text-xs text-gray-500">Available</div>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      Starting at
                    </div>
                    <div className="text-sm font-bold text-primary-600">
                      Rs. {Math.min(...featuredServices.filter(s => s.price).map(s => s.price!)).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/services/${featuredServices[0]?.slug || ''}`}
                    className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
                  >
                    View Details <FiArrowRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleBookNow(featuredServices[0])}
                    className="inline-flex items-center gap-2 bg-dark-900 hover:bg-gray-800 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Services - Show Category Cards */}
        {/* Specific Category - Show Services Grid */}
        {selectedCategory && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filteredServices.slice(0, 8).map((service) => (
                <div
                  key={service.id}
                  className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 hover:shadow-lg transition-all duration-[275ms] hover:scale-105 hover:z-10"
                >
                  <div className="relative h-28 md:h-32 overflow-hidden">
                    {service.image?.startsWith('/uploads/') ? (
                    <img
                      src={getImageUrl(service.image)}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                  <Image
                    src={service.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'}
                    alt={service.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
              </div>

              <div className="p-3 md:p-4">
                <h4 className="font-bold text-gray-900 text-sm md:text-base mb-1 line-clamp-1 group-hover:text-primary-600 transition-colors">
                  {service.title}
                </h4>
                
                <p className="text-gray-500 text-xs mb-3 line-clamp-2 hidden md:block">
                  {service.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-primary-600 font-bold text-sm">
                    {service.price 
                      ? `Starting from LKR ${service.price.toLocaleString()}+` 
                      : 'Contact'}
                  </span>
                  <button
                    onClick={() => handleBookNow(service)}
                    className="text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Book
                  </button>
                </div>
              </div>
            </div>
          ))}
            </div>
          </>
        )}

        {/* View All Services */}
        <div className="text-center mt-10">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-dark-900 font-bold px-8 py-4 rounded-xl transition-colors"
          >
            View All Services
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Industries We Serve - Rolling Carousel */}
        <div className="mt-20">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-dark-900 mb-2">
              Industries We Serve
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Professional services for every industry
            </p>
          </div>
          
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll gap-4 md:gap-6 w-max">
              {industries.length > 0 ? (
                <>
                  {industries.map((industry) => (
                    <div key={industry.id} className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                      <div className="h-24 md:h-28 overflow-hidden bg-gray-100">
                        {industry.image && industry.image.length > 10 ? (
                          <img
                            src={industry.image}
                            alt={industry.name}
                            className="w-full h-full object-cover"
                            loading="eager"
                            onError={(e) => {
                              console.log('Image load error:', industry.name, industry.image)
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.parentElement.innerHTML = `<span class="text-3xl">${industry.icon || '🏢'}</span>`
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                            <span className="text-3xl">{industry.icon || '🏢'}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <h4 className="font-semibold text-dark-900 text-sm">{industry.name}</h4>
                      </div>
                    </div>
                  ))}
                  {/* Duplicate for continuous scroll */}
                  {industries.map((industry) => (
                    <div key={`${industry.id}-dup`} className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                      <div className="h-24 md:h-28 overflow-hidden bg-gray-100">
                        {industry.image && industry.image.length > 10 ? (
                          <img
                            src={industry.image}
                            alt={industry.name}
                            className="w-full h-full object-cover"
                            loading="eager"
                            onError={(e) => {
                              console.log('Image load error:', industry.name, industry.image)
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.parentElement.innerHTML = `<span class="text-3xl">${industry.icon || '🏢'}</span>`
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                            <span className="text-3xl">{industry.icon || '🏢'}</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <h4 className="font-semibold text-dark-900 text-sm">{industry.name}</h4>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                /* Fallback when no industries data */
                <>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                      <span className="text-3xl">🏬</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Shopping Malls</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                      <span className="text-3xl">🏫</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Schools</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                      <span className="text-3xl">🏠</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Real Estate</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                      <span className="text-3xl">🏥</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Hospitals</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-3xl">🏭</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Industrial</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                      <span className="text-3xl">🏢</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Office</h4>
                    </div>
                  </div>
                  {/* Duplicates for scroll */}
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                      <span className="text-3xl">🏬</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Shopping Malls</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                      <span className="text-3xl">🏫</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Schools</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                      <span className="text-3xl">🏠</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Real Estate</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                      <span className="text-3xl">🏥</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Hospitals</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-3xl">🏭</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Industrial</h4>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-40 md:w-48 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <div className="h-24 md:h-28 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                      <span className="text-3xl">🏢</span>
                    </div>
                    <div className="p-3 text-center">
                      <h4 className="font-semibold text-dark-900 text-sm">Office</h4>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Partner Section */}
          <div className="text-center mt-10">
            <p className="text-sm text-primary-600 font-medium uppercase mb-2">Our Partner</p>
            <h3 className="text-xl font-bold text-dark-900 mb-2">MX Cleaning Solution</h3>
            <p className="text-gray-600 text-sm">Reliable cleaning partner committed to excellence</p>
          </div>
        </div>
      </div>
    </section>
  )
}
