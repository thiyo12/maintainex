'use client'

import { useRouter } from 'next/navigation'

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
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group">
      {service.image && (
        <div className="h-48 overflow-hidden">
          <img 
            src={service.image} 
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-6">
        <h3 className="text-xl font-bold text-dark-900 mb-2">
          {service.name}
        </h3>
        <p className="text-gray-600 mb-4 line-clamp-2">
          {service.description || 'Professional cleaning service'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-primary-600">
            Rs. {service.price.toLocaleString()}
          </span>
          <button 
            onClick={handleBookNow}
            className="bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold px-4 py-2 rounded-lg transition-all duration-300"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  )
}
