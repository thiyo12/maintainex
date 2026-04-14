'use client'

import Link from 'next/link'
import Image from 'next/image'
import { FiArrowRight } from 'react-icons/fi'

interface Service {
  id: string
  title: string
  slug: string
  description: string
  price: number | null
  duration: number | null
  image: string | null
}

interface ServiceCardNewProps {
  service: Service
}

export default function ServiceCardNew({ service }: ServiceCardNewProps) {
  const priceDisplay = service.price 
    ? `Rs. ${service.price.toLocaleString()}+` 
    : 'Contact for quote'

  const durationDisplay = service.duration 
    ? `${service.duration} min` 
    : null

  return (
    <Link
      href={`/booking?service=${service.slug}`}
      className="group block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300"
    >
      <div className="relative h-48 overflow-hidden">
        <Image
          src={service.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'}
          alt={service.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        
        {durationDisplay && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-gray-700">
            {durationDisplay}
          </div>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
          {service.title}
        </h3>
        
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">
          {service.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-primary-600 font-bold">
            {priceDisplay}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-gray-600 group-hover:text-primary-600 transition-colors">
            Book
            <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  )
}
