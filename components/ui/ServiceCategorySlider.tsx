'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const SLIDER_IMAGES = [
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=1200&h=675&fit=crop', 
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1563453392312-cef7d3fe93d1?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200&h=675&fit=crop',
  'https://images.unsplash.com/photo-1585232004423-244e0e62b3a1?w=1200&h=675&fit=crop',
]

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  image: string | null
  description: string | null
  isActive: boolean
}

interface ServiceCategorySliderProps {
  categories: Category[]
}

export default function ServiceCategorySlider({ categories = [] }: ServiceCategorySliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady) return
    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % SLIDER_IMAGES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [isReady])

  // Get category info or use default
  const getCategoryInfo = (index: number) => {
    const cat = categories[index]
    return {
      name: cat?.name || 'Our Services',
      slug: cat?.slug || 'services',
      icon: cat?.icon || '✨'
    }
  }

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + SLIDER_IMAGES.length) % SLIDER_IMAGES.length)
  }

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % SLIDER_IMAGES.length)
  }

  const catInfo = getCategoryInfo(currentIndex)
  const imageUrl = SLIDER_IMAGES[currentIndex]

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl bg-gray-900">
      <Link 
        href={`/services?category=${catInfo.slug}`}
        className="block w-full h-full relative"
      >
        <img
          src={imageUrl}
          alt={catInfo.name}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-3 md:p-4 inline-block">
            <h3 className="text-lg md:text-xl font-bold text-white">
              {catInfo.name.toUpperCase()}
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

      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDER_IMAGES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-2 rounded-full transition-all ${
              idx === currentIndex ? 'bg-white w-6' : 'bg-white/50 w-2 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  )
}