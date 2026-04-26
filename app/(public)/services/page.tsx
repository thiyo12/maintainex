'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
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
  category?: {
    id: string
    name: string
    slug: string
  }
}

interface Subcategory {
  id: string
  name: string
  slug: string
  displayOrder: number
  serviceCount: number
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image: string | null
  displayOrder: number
  subcategories: Subcategory[]
  defaultSubcategoryId: string | null
  services: Service[]
  _count?: { services: number }
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
  const [allServices, setAllServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(categoryParam || '')
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

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

      const servicesArr = Array.isArray(servicesData) ? servicesData : (servicesData.services || [])
      const categoriesArr = Array.isArray(categoriesData) ? categoriesData : (categoriesData.categories || [])
      
      setCategories(categoriesArr)
      setAllServices(servicesArr)
      
      if (categoriesArr.length > 0 && categoriesArr[0].defaultSubcategoryId) {
        setSelectedCategorySlug(categoriesArr[0].slug)
        setSelectedSubcategoryId(categoriesArr[0].defaultSubcategoryId)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = categories.find(c => c.slug === selectedCategorySlug)
  const subcategoryServices = selectedCategory?.services.filter((s: Service) => 
    s.categoryId === (selectedSubcategoryId || selectedCategory?.defaultSubcategoryId)
  ) || []

  const handleCategoryClick = (category: Category) => {
    setSelectedCategorySlug(category.slug)
    setSelectedSubcategoryId(category.defaultSubcategoryId || '')
  }

  const handleServiceClick = (service: Service) => {
    const categoryName = selectedCategory?.name || 'Unknown'
    const subcategory = selectedCategory?.subcategories?.find(s => s.id === service.categoryId)
    const fullCategoryName = subcategory ? `${categoryName} - ${subcategory.name}` : categoryName
    
    localStorage.setItem('selectedService', JSON.stringify({
      id: service.id,
      name: service.name,
      price: service.price,
      category: fullCategoryName,
      subcategoryId: service.categoryId
    }))
    router.push(`/booking?serviceId=${service.id}`)
  }

  const handleBookNow = () => {
    const categoryName = selectedCategory?.name || 'Unknown'
    const subcategory = selectedCategory?.subcategories?.find(s => s.id === selectedSubcategoryId)
    const fullCategoryName = subcategory ? `${categoryName} - ${subcategory.name}` : categoryName
    
    localStorage.setItem('selectedCategory', JSON.stringify({
      mainCategory: selectedCategory?.name,
      subcategoryId: selectedSubcategoryId,
      categoryName: fullCategoryName
    }))
    router.push(`/booking`)
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
            <p className="text-gray-800 text-center max-w-2xl mx-auto mb-6">
              Professional home services at your fingertips. Choose a service to get started.
            </p>
            
            {/* Search */}
            <div className="max-w-md mx-auto">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-full border-2 border-white/50 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:border-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Category Cards with Subcategories */}
        <div className="bg-white border-b sticky top-16 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex overflow-x-auto gap-3 pb-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryClick(category)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full font-medium transition-all ${
                    selectedCategorySlug === category.slug
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Services Section - Main Category + First Subcategory Cards */}
        <section id="services-section" className="py-8 md:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {selectedCategory && (
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  {selectedCategory.name}
                </h2>
                <p className="text-gray-600">
                  {selectedCategory.subcategories?.[0]?.name || 'Select a service'}
                </p>
              </div>
            )}

            {subcategoryServices.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                  {subcategoryServices.map((service) => (
                    <div 
                      key={service.id}
                      onClick={() => handleServiceClick(service)}
                      className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-yellow-300 hover:shadow-lg transition-all duration-300 cursor-pointer"
                    >
                      <div className="relative h-40 md:h-44 overflow-hidden bg-gray-100">
                        {service.image ? (
                          <img
                            src={getImageUrl(service.image)}
                            alt={service.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                            <span className="text-4xl">🔧</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">
                          {service.name}
                        </h3>
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {service.description}
                        </p>
                        <button className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-2 rounded-lg transition-colors text-sm">
                          Book Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
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