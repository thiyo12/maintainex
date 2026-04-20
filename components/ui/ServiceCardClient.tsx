'use client'

import { useRouter } from 'next/navigation'
import { getImageUrl } from '@/lib/images'

interface ServiceCardClientProps {
  service: {
    id: string
    name: string
    slug?: string | null
    description?: string | null
    price: number
    image?: string | null
    category?: {
      name?: string
    }
  }
}

export default function ServiceCardClient({ service }: ServiceCardClientProps) {
  const router = useRouter()

  const handleBookNow = () => {
    localStorage.setItem('selectedService', JSON.stringify({
      id: service.id,
      name: service.name,
      price: service.price,
      category: service.category?.name
    }))
    router.push(`/booking?serviceId=${service.id}`)
  }

  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 hover:shadow-lg transition-all duration-300">
      <div className="relative h-40 overflow-hidden">
        {service.image && (
          <img 
            src={getImageUrl(service.image)} 
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-1 group-hover:text-primary-600 transition-colors">
          {service.name}
        </h3>
        <p className="text-gray-500 text-sm mb-3 line-clamp-2">
          {service.description || 'Professional cleaning service'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-primary-600 font-bold">
            Rs. {service.price.toLocaleString()}
          </span>
          <button 
            onClick={handleBookNow}
            className="bg-primary-500 hover:bg-primary-600 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  )
}
