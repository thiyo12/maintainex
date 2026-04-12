'use client'

import Link from 'next/link'
import { FiArrowRight, FiClock } from 'react-icons/fi'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
}

interface Service {
  id: string
  title: string
  slug: string
  description: string
  price: number | null
  duration: number | null
  image: string | null
}

interface FeaturedServiceProps {
  category: Category
  services: Service[]
}

export default function FeaturedService({ category, services }: FeaturedServiceProps) {
  const firstService = services[0]
  const priceDisplay = firstService?.price 
    ? `Rs. ${firstService.price.toLocaleString()}+` 
    : 'Contact for quote'

  const totalJobs = Math.floor(Math.random() * 5000) + 1000

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-xl mb-12">
      <div className="grid lg:grid-cols-2">
        <div className="relative h-64 lg:h-auto">
          <img
            src={firstService?.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800'}
            alt={category.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />
        </div>

        <div className="p-8 lg:p-12 flex flex-col justify-center">
          <div className="inline-block px-4 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-4 w-fit">
            Popular Category
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            {category.name}
          </h2>

          <p className="text-gray-600 mb-6">
            {category.description || `Professional ${category.name.toLowerCase()} services for your home and business.`}
          </p>

          <div className="flex items-center gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {totalJobs.toLocaleString()}+
              </div>
              <div className="text-sm text-gray-500">Jobs Done</div>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {services.length}
              </div>
              <div className="text-sm text-gray-500">Services</div>
            </div>
            {firstService?.duration && (
              <>
                <div className="h-12 w-px bg-gray-200" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 flex items-center gap-1">
                    <FiClock className="w-5 h-5" />
                    {firstService.duration}
                  </div>
                  <div className="text-sm text-gray-500">Minutes</div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-primary-600">
              Starting from {priceDisplay}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {services.slice(0, 4).map((service) => (
              <Link
                key={service.id}
                href={`/booking?service=${service.slug}`}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-primary-100 hover:text-primary-700 transition-colors"
              >
                {service.title}
              </Link>
            ))}
            {services.length > 4 && (
              <span className="px-3 py-1 text-gray-500 text-sm">
                +{services.length - 4} more
              </span>
            )}
          </div>

          <Link
            href={`/booking?service=${firstService?.slug || ''}`}
            className="mt-8 inline-flex items-center justify-center gap-2 bg-primary-500 text-dark-900 font-bold px-8 py-4 rounded-xl hover:bg-primary-600 transition-colors w-fit"
          >
            Book Now
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
