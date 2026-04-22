'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=1200&h=675&fit=crop', 
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1563453392312-cef7d3fe93d1?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1585232004423-244e0e62b3a1?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1585232004423-244e0e62b3a1?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=675&fit=crop',
]

interface Service {
  id: string
  name: string
  slug: string | null
  image: string | null
}

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  image: string | null
  services: Service[]
  isActive: boolean
}

interface ServiceCategorySliderProps {
  categories: Category[]
}

function getImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('/uploads/')) {
    return `/api/files${url}`
  }
  if (url.startsWith('http')) {
    return url
  }
  if (url.startsWith('/')) {
    return `/api/files${url}`
  }
  return `/api/files/${url}`
}

export default function ServiceCategorySlider({ categories = [] }: ServiceCategorySliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setLoaded(true)
  }, [])

  // Get the "main" data for each category - first service's image or category image
  const getCategorySlides = () => {
    return categories.map((cat) => {
      // Get first service that has an image
      const firstServiceWithImage = cat.services?.find(s => s.image)
      const mainImage = firstServiceWithImage?.image || cat.image
      
      return {
        name: cat.name,
        slug: cat.slug,
        image: mainImage,
        icon: cat.icon,
        serviceName: firstServiceWithImage?.name || cat.name
      }
    })
  }

  const slides = getCategorySlides()

  useEffect(() => {
    if (!loaded || slides.length === 0) return
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % slides.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [loaded, slides.length])

  const handlePrev = () => {
    if (slides.length === 0) return
    setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length)
  }

  const handleNext = () => {
    if (slides.length === 0) return
    setCurrentIndex(prev => (prev + 1) % slides.length)
  }

  const handleImageError = (idx: number) => {
    setImageErrors(prev => ({ ...prev, [idx]: true }))
  }

  // Loading or no categories
  if (!loaded || slides.length === 0) {
    return (
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary-400 to-primary-600">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-4xl mb-2">🏠</div>
            <p className="font-medium">Loading services...</p>
          </div>
        </div>
      </div>
    )
  }

  const currentSlide = slides[currentIndex]
  const rawImage = currentSlide.image
  const slideImage = rawImage 
    ? (rawImage.startsWith('http') ? rawImage : getImageUrl(rawImage))
    : FALLBACK_IMAGES[currentIndex % FALLBACK_IMAGES.length]
    
  const showFallback = imageErrors[currentIndex] || !rawImage

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-gray-900">
      <Link 
        href={`/services?category=${currentSlide.slug}`}
        className="block w-full h-full relative"
      >
        {showFallback ? (
          <img
            src={FALLBACK_IMAGES[currentIndex % FALLBACK_IMAGES.length]}
            alt={currentSlide.name}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
        ) : (
          <img
            src={slideImage}
            alt={currentSlide.name}
            className="w-full h-full object-cover"
            onError={() => handleImageError(currentIndex)}
          />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 md:p-4 inline-block">
            <h3 className="text-lg md:text-xl font-bold text-white">
              {currentSlide.name.toUpperCase()}
            </h3>
          </div>
        </div>
      </Link>

      <button
        onClick={handlePrev}
        aria-label="Previous"
        className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 md:w-10 md:h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all z-10"
      >
        <FiChevronLeft className="text-white w-6 h-6" />
      </button>
      
      <button
        onClick={handleNext}
        aria-label="Next"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 md:w-10 md:h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all z-10"
      >
        <FiChevronRight className="text-white w-6 h-6" />
      </button>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to ${slides[idx].name}`}
            className={`h-2 rounded-full transition-all ${
              idx === currentIndex ? 'bg-white w-6' : 'bg-white/50 w-2 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  )
}