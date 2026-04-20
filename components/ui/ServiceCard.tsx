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
  const isUploadedImage = image.startsWith('/uploads/')
  const imageSrc = isUploadedImage ? `${image}?t=${Date.now()}` : image
  
  return (
    <div className="card group">
      <div className="relative h-48 overflow-hidden">
        {isUploadedImage ? (
          <img
            src={imageSrc}
            alt={title}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <Image
            src={imageSrc}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
          />
        )}
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link
            href={`/services/${slug}`}
            className="inline-flex items-center justify-center text-primary-600 font-semibold hover:text-primary-700 transition-colors"
          >
            View Details <FiArrowRight className="ml-2" />
          </Link>
          <Link
            href={`/booking?service=${slug}`}
            className="inline-flex items-center justify-center bg-primary-500 text-dark-900 px-4 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors"
          >
            Book Now
          </Link>
        </div>
      </div>
    </div>
  )
}
