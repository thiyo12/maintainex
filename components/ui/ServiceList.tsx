'use client'

import { useRouter } from 'next/navigation'
import { getImageUrl } from '@/lib/images'

interface Service {
  id: string
  name: string
  slug: string | null
  description: string | null
  price: number
  image: string | null
}

interface ServiceListProps {
  services: Service[]
  categoryName: string
}

export default function ServiceList({ services, categoryName }: ServiceListProps) {
  const router = useRouter()

  const handleBookNow = (service: Service) => {
    localStorage.setItem('selectedService', JSON.stringify({
      id: service.id,
      name: service.name,
      price: service.price,
      category: categoryName
    }))
    router.push(`/booking?serviceId=${service.id}`)
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {services.map((service) => (
        <div
          key={service.id}
          className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:border-primary-300 hover:shadow-lg transition-all duration-300"
        >
          <div className="relative h-36 md:h-44 overflow-hidden">
            {service.image ? (
              <img
                src={getImageUrl(service.image)}
                alt={service.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                <span className="text-4xl opacity-50">🧹</span>
              </div>
            )}
          </div>

          <div className="p-3 md:p-4">
            <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1 line-clamp-1 group-hover:text-primary-600 transition-colors">
              {service.name}
            </h3>
            
            <p className="text-gray-500 text-xs mb-3 line-clamp-2 hidden md:block">
              {service.description || 'Professional service'}
            </p>

            <div className="flex items-center justify-between">
              <span className="text-primary-600 font-bold text-sm">
                Rs. {service.price.toLocaleString()}
              </span>
              <button
                onClick={() => handleBookNow(service)}
                className="bg-primary-500 hover:bg-primary-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors text-xs"
              >
                Book
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
