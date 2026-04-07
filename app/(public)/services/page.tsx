'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import Link from 'next/link'
import { FiArrowRight, FiChevronDown, FiChevronUp } from 'react-icons/fi'

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
  services: Service[]
}

export default function ServicesPage() {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        setCategories(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const isExpanded = (categoryId: string) => expandedCategories.includes(categoryId)

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        <section className="py-24 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-dark-900 mb-6">Our Services</h1>
            <p className="text-xl text-dark-900/80 max-w-3xl mx-auto">
              Professional cleaning solutions for every space. From homes to industrial facilities, we deliver exceptional results.
            </p>
          </div>
        </section>

        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : categories.length > 0 ? (
              <div className="space-y-4">
                {categories.map((category) => (
                  <div key={category.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-primary-100">
                          <span className="text-primary-600 font-bold text-xl">
                            {category.name.charAt(0)}
                          </span>
                        </div>
                        <div className="text-left">
                          <h3 className="text-xl font-bold text-dark-900">{category.name}</h3>
                          <p className="text-gray-500 text-sm">{category.services.length} services available</p>
                        </div>
                      </div>
                      <div className={`p-2 rounded-full transition-colors ${
                        isExpanded(category.id) ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isExpanded(category.id) ? <FiChevronUp size={24} /> : <FiChevronDown size={24} />}
                      </div>
                    </button>

                    {isExpanded(category.id) && (
                      <div className="border-t border-gray-100">
                        {category.services.length > 0 ? (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                            {category.services.map((service) => (
                              <div key={service.id} className="bg-gray-50 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                                <div className="relative h-36">
                                  <img
                                    src={service.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'}
                                    alt={service.title}
                                    className="w-full h-full object-cover"
                                  />
                                  {service.price && (
                                    <div className="absolute top-3 right-3 bg-primary-500 text-dark-900 px-2 py-1 rounded-full font-semibold text-xs">
                                      From LKR {service.price.toLocaleString()}
                                    </div>
                                  )}
                                </div>
                                <div className="p-4">
                                  <h4 className="font-bold text-dark-900 mb-1">{service.title}</h4>
                                  <p className="text-gray-600 text-xs mb-3 line-clamp-2">{service.description}</p>
                                  <Link
                                    href={`/booking?service=${service.slug}`}
                                    className="text-primary-600 font-semibold text-sm inline-flex items-center hover:text-primary-700"
                                  >
                                    Book Now <FiArrowRight className="ml-1" size={14} />
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-gray-500">
                            No services available in this category yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-12 text-center shadow-md">
                <h2 className="text-2xl font-bold text-dark-900 mb-4">Services Coming Soon</h2>
                <p className="text-gray-600">Our team is working on adding new services. Please check back soon!</p>
              </div>
            )}
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6">
              Need a Custom Solution?
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Contact us for a free consultation. We&apos;ll assess your needs and create a tailored cleaning plan.
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
