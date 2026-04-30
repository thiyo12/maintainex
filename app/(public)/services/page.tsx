'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { getImageUrl } from '@/lib/images'

interface Service {
  id: string
  title: string
  slug: string | null
  description: string
  image: string | null
  price: number | null
  duration: number | null
  categoryId: string
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image: string | null
  displayOrder: number
  serviceCount: number
  services: Service[]
}

export default function ServicesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    }>
      <ServicesContent />
    </Suspense>
  )
}

function ServicesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategorySlug(categoryParam)
    }
  }, [categoryParam])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = categories.find(c => c.slug === selectedCategorySlug)
  const firstService = selectedCategory?.services?.[0]

  const handleCategoryClick = (category: Category) => {
    setSelectedCategorySlug(category.slug)
  }

  const handleBookNow = (category: Category) => {
    const firstSvc = category.services?.[0]
    if (firstSvc) {
      localStorage.setItem('selectedService', JSON.stringify({
        id: firstSvc.id,
        name: firstSvc.title,
        price: firstSvc.price,
        category: category.name,
        categoryId: category.id
      }))
      router.push(`/booking?serviceId=${firstSvc.id}&category=${category.slug}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400"></div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20 min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-yellow-400 to-yellow-500 py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center">
              Our Services
            </h1>
            {selectedCategory && (
              <div className="flex justify-center mb-4">
                <button 
                  onClick={() => {
                    router.push('/services')
                  }}
                  className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2"
                >
                  ← View All Categories
                </button>
              </div>
            )}
            {selectedCategory && (
              <p className="text-gray-800 text-center max-w-2xl mx-auto mb-6">
                {selectedCategory.services?.length || 0} services in {selectedCategory.name}
              </p>
            )}
            {!selectedCategory && (
            <p className="text-gray-800 text-center max-w-2xl mx-auto mb-6">
              Professional home services at your fingertips. Choose a service to get started.
            </p>
            )}
          </div>
        </section>

        {/* ALL Services Grid - Grouped by Category */}
        {!selectedCategorySlug && (
        <section id="all-services" className="py-8 md:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {categories.map((category) => (
              category.services && category.services.length > 0 && (
                <div key={category.id} className="mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    {category.icon && <span className="text-2xl">{category.icon}</span>}
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                      {category.name}
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {category.services.map((service) => (
                      <div 
                        key={service.id}
                        className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 hover:shadow-lg transition-all duration-300"
                      >
                        <div className="relative h-28 md:h-32 overflow-hidden bg-gray-100">
                          {service.image ? (
                            <img
                              src={getImageUrl(service.image)}
                              alt={service.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                              <span className="text-4xl">🧹</span>
                            </div>
                          )}
                        </div>

                        <div className="p-4">
                          <h3 className="font-bold text-gray-900 mb-1">
                            {service.title}
                          </h3>
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                            {service.description || 'Professional service'}
                          </p>
                          <p className="text-lg font-bold text-primary-600 mb-3">
                            {service.price ? `Rs. ${service.price.toLocaleString()}` : 'Contact us'}
                          </p>
                          <button 
                            onClick={() => {
                              localStorage.setItem('selectedService', JSON.stringify({
                                id: service.id,
                                name: service.title,
                                price: service.price,
                                category: category.name
                              }))
                              router.push(`/booking?serviceId=${service.id}&category=${category.slug}`)
                            }}
                            className="w-full bg-primary-500 hover:bg-primary-600 text-gray-900 font-semibold py-2 rounded-lg transition-colors text-sm"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </section>
        )}

        {/* Show Services in Selected Category */}
        {selectedCategorySlug && selectedCategory?.services && selectedCategory.services.length > 0 && (
          <section id="services-list" className="py-8 md:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {selectedCategory.services.map((service) => (
                  <div 
                    key={service.id}
                    className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="relative h-28 md:h-32 overflow-hidden bg-gray-100">
                      {service.image ? (
                        <img
                          src={getImageUrl(service.image)}
                          alt={service.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                          <span className="text-4xl">🧹</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1">
                        {service.title}
                      </h3>
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                        {service.description || 'Professional service'}
                      </p>
                      <p className="text-lg font-bold text-primary-600 mb-3">
                        {service.price ? `Rs. ${service.price.toLocaleString()}` : 'Contact us'}
                      </p>
                      <button 
                        onClick={() => {
                          localStorage.setItem('selectedService', JSON.stringify({
                            id: service.id,
                            name: service.title,
                            price: service.price,
                            category: selectedCategory.name
                          }))
                          router.push(`/booking?serviceId=${service.id}&category=${selectedCategory.slug}`)
                        }}
                        className="w-full bg-primary-500 hover:bg-primary-600 text-gray-900 font-semibold py-2 rounded-lg transition-colors text-sm"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Category Cards - Show when NO category selected */}
        {!selectedCategorySlug && (
        <section id="services-section" className="py-8 md:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {categories.map((category) => {
                const firstSvc = category.services?.[0]
                return (
                  <div 
                    key={category.id}
                    className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-yellow-300 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="relative h-28 md:h-32 overflow-hidden bg-gray-100">
                      {firstSvc?.image ? (
                        <img
                          src={getImageUrl(firstSvc.image)}
                          alt={category.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                          <span className="text-4xl">🧹</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1">
                        {category.name}
                      </h3>
                      <p className="text-gray-600 text-sm mb-2">
                        {firstSvc?.title || 'No services'}
                      </p>
                      <p className="text-lg font-bold text-yellow-600 mb-3">
                        {firstSvc?.price ? `Rs. ${firstSvc.price.toLocaleString()}` : 'Contact us'}
                      </p>
                      <button 
                        onClick={() => handleBookNow(category)}
                        className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-2 rounded-lg transition-colors text-sm"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
        )}

        {/* CTA Section */}
        <section className="py-12 bg-gradient-to-br from-yellow-400 to-yellow-500">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Need Help Choosing?
            </h2>
            <p className="text-gray-800 mb-6">
              Contact us and we will help you find the right service.
            </p>
            <a 
              href="/contact" 
              className="inline-block bg-gray-900 hover:bg-gray-800 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Contact Us
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}