'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import CategoryTabs from '@/components/ui/CategoryTabs'
import { getImageUrl } from '@/lib/images'

interface Service {
  id: string
  name: string
  slug: string | null
  description: string
  shortDescription: string | null
  price: number
  duration: number
  image: string | null
  categoryId: string
  category: {
    id: string
    name: string
    slug: string
  }
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  displayOrder: number
  _count?: { services: number }
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="text-lg">Loading...</span></div>}>
      <ServicesContent />
    </Suspense>
  )
}

function ServicesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')

  const [categories, setCategories] = useState<Category[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam || '')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam)
    }
  }, [categoryParam])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [categoriesRes, servicesRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/services')
      ])
      
      if (!categoriesRes.ok || !servicesRes.ok) {
        console.error('API errors:', categoriesRes.status, servicesRes.status)
        setLoading(false)
        return
      }
      
      const categoriesData = await categoriesRes.json()
      const servicesData = await servicesRes.json()

      console.log('Categories API:', categoriesData)
      console.log('Services API:', servicesData)

      // Handle both array and {services: []} formats
      const services = Array.isArray(servicesData) ? servicesData : (servicesData.services || [])
      const categories = Array.isArray(categoriesData) ? categoriesData : (categoriesData.categories || [])
      
      const categoriesWithCount = categories.map((cat: Category) => ({
        ...cat,
        _count: { services: services.filter((s: Service) => s.category?.slug === cat.slug).length }
      }))

      setCategories(categoriesWithCount)
      setServices(services)
      console.log('Loaded:', services.length, 'services,', categories.length, 'categories')
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter services based on selected category and search
  const filteredServices = services.filter(service => {
    const matchesCategory = selectedCategory 
      ? service.category?.slug === selectedCategory
      : true
    const matchesSearch = searchQuery
      ? service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
    return matchesCategory && matchesSearch
  })

  const handleServiceClick = (service: Service) => {
    localStorage.setItem('selectedService', JSON.stringify({
      id: service.id,
      name: service.name,
      price: service.price,
      category: service.category.name
    }))
    router.push(`/booking?serviceId=${service.id}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20 min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-400 to-primary-600 py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl md:text-4xl font-bold text-dark-900 mb-3 text-center">
              Our Services
            </h1>
            <p className="text-dark-900/80 text-center max-w-2xl mx-auto mb-6">
              Professional home services at your fingertips. Choose a service to get started.
            </p>
            
            {/* Search */}
            <div className="max-w-md mx-auto">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-full border-2 border-white/50 bg-white/90 text-dark-900 placeholder-gray-500 focus:outline-none focus:border-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Category Tabs */}
        <div className="bg-white border-b sticky top-16 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <CategoryTabs 
              categories={categories} 
              selectedCategory={selectedCategory}
            />
          </div>
        </div>

        {/* Services Grid */}
        <section id="services-section" className="py-8 md:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Title */}
            <div className="mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                {selectedCategory 
                  ? categories.find(c => c.slug === selectedCategory)?.name || 'Services'
                  : 'All Services'
                }
              </h2>
              <p className="text-gray-600">
                {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} available
              </p>
            </div>

            {/* Services Grid - 3 columns on mobile, 4 on desktop */}
            {filteredServices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {filteredServices.map((service) => (
                  <div 
                    key={service.id}
                    onClick={() => handleServiceClick(service)}
                    className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 hover:shadow-lg transition-all duration-300 cursor-pointer"
                  >
                    {/* Image */}
                    <div className="relative h-40 md:h-44 overflow-hidden">
                      {service.image ? (
                        <img
                          src={getImageUrl(service.image)}
                          alt={service.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                          <span className="text-4xl">🧹</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">
                        {service.name}
                      </h3>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {service.description || service.shortDescription}
                      </p>
                      <button className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2 rounded-lg transition-colors text-sm">
                        Book Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No services found</h3>
                <p className="text-gray-600">
                  {searchQuery 
                    ? `No results for "${searchQuery}". Try a different search term.`
                    : 'No services available in this category yet.'
                  }
                </p>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-gradient-to-br from-primary-400 to-primary-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-dark-900 mb-4">
              Need Help Choosing?
            </h2>
            <p className="text-dark-900/80 mb-6">
              Contact us and we will help you find the right service.
            </p>
            <a 
              href="/contact" 
              className="inline-block bg-dark-900 hover:bg-dark-800 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
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