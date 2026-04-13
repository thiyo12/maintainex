import Link from 'next/link'
import Image from 'next/image'
import { FiArrowRight } from 'react-icons/fi'

interface ServiceCardProps {
  title: string
  description: string
  image: string
  slug: string
  price?: number
}

export function ServiceCard({ title, description, image, slug, price }: ServiceCardProps) {
  return (
    <div className="card group">
      <div className="relative h-48 overflow-hidden">
        <Image
          src={image}
          alt={title}
          width={400}
          height={192}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {price && (
          <div className="absolute top-4 right-4 bg-primary-500 text-dark-900 px-3 py-1 rounded-full font-semibold">
            From LKR {price.toLocaleString()}
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-dark-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4 line-clamp-2">{description}</p>
        <Link
          href={`/booking?service=${slug}`}
          className="inline-flex items-center text-primary-600 font-semibold hover:text-primary-700 transition-colors"
        >
          Book Now <FiArrowRight className="ml-2" />
        </Link>
      </div>
    </div>
  )
}
