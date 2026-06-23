'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FiArrowRight, FiTrendingUp, FiEye } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'

interface Service {
  id: string
  name: string
  slug: string | null
  description: string
  price: number | null
  duration: number | null
  image: string | null
  views: number
  isTrending: boolean
}

interface TrendingServicesProps {
  services: Service[]
}

export default function TrendingServices({ services }: TrendingServicesProps) {
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})
  const [visible, setVisible] = useState<Set<number>>(new Set())
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([])

  useEffect(() => {
    if (!services?.length) return
    cardRefs.current = cardRefs.current.slice(0, services.length)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            if (!isNaN(index)) {
              setVisible((prev) => new Set(prev).add(index))
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
    )

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [services])

  if (!services || services.length === 0) {
    return null
  }

  const handleImageError = (serviceId: string) => {
    setImgErrors(prev => ({ ...prev, [serviceId]: true }))
  }

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl">
              <FiTrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                Trending Services
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                Most popular services our customers love
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {services.map((service, index) => {
            const isUploadedImage = service.image?.startsWith('/uploads/') && !imgErrors[service.id]
            const fallbackImage = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600'
            const imageSrc = isUploadedImage ? getImageUrl(service.image) : (service.image || fallbackImage)
            const isVisible = visible.has(index)

            return (
              <Link
                key={service.id}
                data-index={index}
                ref={(el) => { cardRefs.current[index] = el }}
                href={`/services/${service.slug || service.id}`}
                className={`group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-orange-200 ${
                  isVisible ? 'animate-pop-in' : 'opacity-0 scale-90'
                }`}
                style={{
                  animationDelay: `${index * 180}ms`,
                  animationDuration: '900ms',
                  animationFillMode: 'both',
                }}
              >
                <div className="relative h-28 sm:h-36 md:h-44 overflow-hidden">
                  {isUploadedImage ? (
                    <img
                      src={imageSrc}
                      alt={service.name}
                      width="400"
                      height="300"
                      onError={() => handleImageError(service.id)}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Image
                      src={imageSrc}
                      alt={service.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      onError={() => handleImageError(service.id)}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  
                  <div className="absolute top-2 left-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <span>🔥</span>
                    <span>#{index + 1}</span>
                  </div>

                  {service.isTrending && (
                    <div className="absolute top-2 right-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      Trending
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 bg-gradient-to-r from-amber-500/90 to-orange-500/90 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 shadow-lg">
                    <FiEye className="w-3.5 h-3.5" />
                    <span>{service.views || 0}</span>
                  </div>
                </div>

                <div className="p-3 md:p-4">
                  <h3 className="font-bold text-gray-900 text-sm md:text-base mb-1 group-hover:text-orange-600 transition-colors line-clamp-1">
                    {service.name}
                  </h3>
                  
                  <div className="flex items-center justify-end">
                    <FiArrowRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="text-center mt-8">
          <Link 
            href="/services" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg hover:scale-105 transition-all"
          >
            View All Services
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <style jsx>{`
        @keyframes popIn {
          0% {
            opacity: 0;
            transform: scale(0.75) translateY(24px);
          }
          50% {
            transform: scale(1.04) translateY(-4px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-pop-in {
          animation: popIn 900ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>
    </section>
  )
}