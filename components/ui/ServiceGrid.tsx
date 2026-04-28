'use client'

import ServiceCardNew from './ServiceCardNew'

interface Service {
  id: string
  title: string
  slug: string
  description: string
  price: number | null
  duration: number | null
  image: string | null
}

interface ServiceGridProps {
  services: Service[]
  title?: string
}

export default function ServiceGrid({ services, title }: ServiceGridProps) {
  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No services found in this category.</p>
      </div>
    )
  }

  return (
    <div>
      {title && (
        <h3 className="text-2xl font-bold text-gray-900 mb-6">{title}</h3>
      )}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {services.map((service) => (
          <ServiceCardNew key={service.id} service={service} />
        ))}
      </div>
    </div>
  )
}
