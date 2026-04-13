'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FiTool, FiImage, FiPackage, FiStar, FiCloud, FiZap, FiTrendingUp, FiArrowRight, FiClock } from 'react-icons/fi'

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

export default function HomeServices({ initialCategories, initialServices }: HomeServicesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const categories = initialCategories
  const allServices = initialServices

  const filteredServices = selectedCategory
    ? allServices.filter(s => categories.find(c => c.slug === selectedCategory)?.services.some(sv => sv.id === s.id))
    : allServices

  const featuredCategory = selectedCategory
    ? categories.find(c => c.slug === selectedCategory)
    : categories[0]

  const featuredServices = featuredCategory?.services || []

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-primary-600 font-semibold">OUR SERVICES</span>
          <h2 className="section-title">Book trusted help for home tasks</h2>
          <p className="section-subtitle">
            Professional services at your fingertips. From assembly to cleaning, we have you covered.
          </p>
        </div>

        {/* Category Pills */}
        <div className="w-full overflow-x-auto pb-4 mb-8">
          <div className="flex gap-3 min-w-max px-4 justify-center">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all duration-300 whitespace-nowrap ${
                selectedCategory === null
                  ? 'bg-primary-500 text-dark-900 shadow-lg shadow-primary-500/30'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              All Services
            </button>
            
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.slug)}
                className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all duration-300 whitespace-nowrap ${
                  selectedCategory === category.slug
                    ? 'bg-primary-500 text-dark-900 shadow-lg shadow-primary-500/30'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {iconMap[category.icon || 'wrench'] || <FiStar className="w-5 h-5" />}
                <span>{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Featured Service */}
        {featuredServices.length > 0 && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl mb-8">
            <div className="grid lg:grid-cols-2">
              <div className="relative h-48 lg:h-auto">
                <Image
                  src={featuredServices[0]?.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800'}
                  alt={featuredCategory?.name || 'Featured service'}
                  width={800}
                  height={600}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
              </div>

              <div className="p-8 lg:p-10 flex flex-col justify-center">
                <div className="inline-block px-4 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-4 w-fit">
                  Popular Category
                </div>

                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">
                  {featuredCategory?.name}
                </h3>

                <p className="text-gray-600 mb-4">
                  {featuredCategory?.description || `Professional ${featuredCategory?.name?.toLowerCase()} services.`}
                </p>

                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-900">
                      {featuredServices.length}
                    </div>
                    <div className="text-xs text-gray-500">Services</div>
                  </div>
                  <div className="h-8 w-px bg-gray-200" />
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-900">4.8</div>
                    <div className="text-xs text-gray-500">Rating</div>
                  </div>
                </div>

                <Link
                  href={`/booking?service=${featuredServices[0]?.slug || ''}`}
                  className="inline-flex items-center gap-2 bg-primary-500 text-dark-900 font-bold px-6 py-3 rounded-xl hover:bg-primary-600 transition-colors w-fit"
                >
                  Book Now <FiArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Services Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.slice(0, 8).map((service) => (
            <Link
              key={service.id}
              href={`/booking?service=${service.slug}`}
              className="group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
            >
<div className="relative h-40 overflow-hidden">
                  <Image
                    src={service.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'}
                    alt={service.title}
                    width={600}
                    height={400}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                {service.duration && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-gray-700 flex items-center gap-1">
                    <FiClock className="w-3 h-3" />
                    {service.duration} min
                  </div>
                )}
              </div>

              <div className="p-4">
                <h4 className="font-bold text-gray-900 mb-1 group-hover:text-primary-600 transition-colors">
                  {service.title}
                </h4>
                
                <p className="text-gray-500 text-xs mb-3 line-clamp-2">
                  {service.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-primary-600 font-bold text-sm">
                    {service.price 
                      ? `Rs. ${service.price.toLocaleString()}+` 
                      : 'Contact for quote'}
                  </span>
                  <span className="text-xs text-gray-500 group-hover:text-primary-600 transition-colors">
                    Book →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* View All Services */}
        <div className="text-center mt-10">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 bg-primary-500 text-dark-900 font-bold px-8 py-4 rounded-xl hover:bg-primary-600 transition-colors"
          >
            View All Services
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
