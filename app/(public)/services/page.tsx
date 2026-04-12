'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import CategoryPills from '@/components/ui/CategoryPills'
import FeaturedService from '@/components/ui/FeaturedService'
import ServiceGrid from '@/components/ui/ServiceGrid'
import ServiceModal from '@/components/ui/ServiceModal'
import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'

interface Service {
  id: string
  title: string
  slug: string
  description: string
  image: string | null
  price: number | null
  duration: number | null
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  services: Service[]
}

export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load categories')
        return res.json()
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Invalid data format')
        setCategories(data || [])
        setLoading(false)
      })
      .catch(() => {
        setCategories([])
        setLoading(false)
      })
  }, [])

  const filteredCategories = selectedCategory && categories.length > 0
    ? categories.filter(c => c.slug === selectedCategory)
    : categories

  const featuredCategory = selectedCategory
    ? filteredCategories[0]
    : (categories.length > 0 ? categories[0] : null)

  const allServices = categories.length > 0 ? categories.flatMap(c => c.services || []) : []

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20 min-h-screen bg-gray-50">
        <section className="gradient-bg py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-dark-900 mb-4">
              Book trusted help for home tasks
            </h1>
            <p className="text-xl text-dark-900/80 max-w-2xl mx-auto">
              Professional services at your fingertips. From assembly to cleaning, we have you covered.
            </p>
          </div>
        </section>

        <section className="sticky top-16 z-40 bg-white shadow-sm py-4">
          <div className="max-w-7xl mx-auto">
            <CategoryPills
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {featuredCategory && featuredCategory.services.length > 0 && (
                  <FeaturedService
                    category={featuredCategory}
                    services={featuredCategory.services}
                  />
                )}

                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {selectedCategory 
                      ? `${featuredCategory?.name || 'Services'}`
                      : 'All Services'
                    }
                  </h2>
                  <ServiceGrid 
                    services={selectedCategory 
                      ? featuredCategory?.services || [] 
                      : allServices
                    } 
                  />
                </div>

                {!selectedCategory && categories.length > 1 && (
                  <div className="mt-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse by Category</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {categories.slice(1).map((category) => (
                        <button
                          key={category.id}
                          onClick={() => setSelectedCategory(category.slug)}
                          className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow text-left group"
                        >
                          <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                            {category.name}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {category.services.length} services
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Need a Custom Solution?
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Contact us for a free consultation. We&apos;ll assess your needs and create a tailored plan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact" className="btn-primary inline-flex items-center justify-center">
                Contact Us <FiArrowRight className="ml-2" />
              </Link>
              <Link href="/booking" className="btn-outline inline-flex items-center justify-center">
                Book a Service
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
