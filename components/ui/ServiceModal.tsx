'use client'

import { useEffect } from 'react'
import { FiX, FiStar, FiClock, FiCheck, FiArrowRight } from 'react-icons/fi'
import Link from 'next/link'
import Image from 'next/image'
import { getImageUrl } from '@/lib/images'

interface Review {
  id: string
  rating: number
  comment: string | null
  customerName: string
  createdAt: string
}

interface Service {
  id: string
  title: string
  slug: string
  description: string
  price: number | null
  duration: number | null
  image: string | null
  reviews?: Review[]
}

interface ServiceModalProps {
  service: Service | null
  isOpen: boolean
  onClose: () => void
}

export default function ServiceModal({ service, isOpen, onClose }: ServiceModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen || !service) return null

  const priceDisplay = service.price 
    ? `Starting from LKR ${service.price.toLocaleString()}+` 
    : 'Contact for quote'

  const isUploadedImage = service.image?.startsWith('/uploads/')
  const imageSrc = isUploadedImage 
    ? getImageUrl(service.image)
    : (service.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800')
  
  const reviews = service.reviews || []
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-600" />
          </button>

          <div className="relative h-56">
            {isUploadedImage ? (
              <img
                src={imageSrc}
                alt={service.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Image
                src={imageSrc}
                alt={service.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <h2 className="text-2xl font-bold text-white">{service.title}</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-primary-600">{priceDisplay}</span>
              {service.duration && (
                <span className="flex items-center gap-1 text-gray-600">
                  <FiClock className="w-4 h-4" />
                  {service.duration} minutes
                </span>
              )}
            </div>

            <p className="text-gray-600 mb-6">{service.description}</p>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">What&apos;s Included:</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-gray-600">
                  <FiCheck className="w-4 h-4 text-green-500" />
                  Professional service provider
                </li>
                <li className="flex items-center gap-2 text-gray-600">
                  <FiCheck className="w-4 h-4 text-green-500" />
                  Quality materials and equipment
                </li>
                <li className="flex items-center gap-2 text-gray-600">
                  <FiCheck className="w-4 h-4 text-green-500" />
                  Satisfaction guaranteed
                </li>
              </ul>
            </div>

            {reviews.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <FiStar
                        key={i}
                        className={`w-5 h-5 ${
                          i < Math.round(Number(avgRating))
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-semibold">{avgRating}</span>
                  <span className="text-gray-500">({reviews.length} reviews)</span>
                </div>

                <div className="space-y-4">
                  {reviews.slice(0, 3).map((review) => (
                    <div key={review.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <FiStar
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-medium text-sm">{review.customerName}</span>
                      </div>
                      {review.comment && (
                        <p className="text-gray-600 text-sm">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link
              href={`/booking?service=${service.slug}`}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 text-dark-900 font-bold py-4 rounded-xl hover:bg-primary-600 transition-colors"
              onClick={onClose}
            >
              Book This Service
              <FiArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
