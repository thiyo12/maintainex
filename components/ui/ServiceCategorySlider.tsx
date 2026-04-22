'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'

const defaultCategoryImages = [
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

export default function ServiceCategorySlider({ categories }: ServiceCategorySliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isHovering, setIsHovering] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeCategories = categories.map((cat, idx) => ({
    ...cat,
    image: cat.image || defaultCategoryImages[idx % defaultCategoryImages.length]
  }))

  // Ensure we have categories - use default placeholder if none
  const displayCategories = activeCategories.length > 0 ? activeCategories : [{
    id: '1',
    name: 'Cleaning Services',
    slug: 'cleaning',
    icon: '🧹',
    image: defaultCategoryImages[0],
    description: 'Professional cleaning services',
    isActive: true
  }]

  useEffect(() => {
    if (!mounted) return
    const length = displayCategories.length
    if (length === 0) return

    const interval = setInterval(() => {
      if (!isHovering) {
        setCurrentIndex(prev => (prev + 1) % length)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [displayCategories.length, isHovering, mounted])

  const nextSlide = useCallback((e?: React.MouseEvent) => { 
    if (e) { e.preventDefault(); e.stopPropagation() }
    setCurrentIndex(prev => (prev + 1) % displayCategories.length) 
  }, [displayCategories.length])

  const prevSlide = useCallback((e?: React.MouseEvent) => { 
    if (e) { e.preventDefault(); e.stopPropagation() }
    setCurrentIndex(prev => (prev - 1 + displayCategories.length) % displayCategories.length) 
  }, [displayCategories.length])

  const goToSlide = useCallback((e: React.MouseEvent, index: number) => { 
    e.preventDefault()
    e.stopPropagation()
    if (index >= 0 && index < displayCategories.length) {
      setCurrentIndex(index) 
    }
  }, [displayCategories.length])

  const safeDisplayIndex = Math.min(currentIndex, displayCategories.length - 1)
  const currentCategory = displayCategories[safeDisplayIndex]
  const getCategoryImage = (cat: typeof currentCategory, idx: number) => {
    if (cat.image) {
      if (cat.image.startsWith('http') || cat.image.startsWith('data:')) return cat.image
      if (cat.image.startsWith('/uploads/') || cat.image.startsWith('/')) return getImageUrl(cat.image)
    }
    return defaultCategoryImages[idx % defaultCategoryImages.length]
  }
  const categoryImage = getCategoryImage(currentCategory, safeDisplayIndex)

  return (
    <div 
      className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Link href={`/services?category=${currentCategory.slug}`} className="block w-full h-full touch-manipulation">
        {categoryImage ? (
          <img
            src={categoryImage}
            alt={currentCategory.name || 'Service Category'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center">
            <span className="text-5xl sm:text-6xl md:text-7xl">{currentCategory.icon || '📋'}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 md:p-4">
            <h3 className="text-lg md:text-xl font-bold text-white">
              {currentCategory.name?.toUpperCase()}
            </h3>
          </div>
        </div>
      </Link>

      {/* Navigation Arrows */}
      <button
        onClick={() => prevSlide()}
        aria-label="Previous slide"
        className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 md:w-10 md:h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center transition-all z-20"
      >
        <FiChevronLeft className="text-white w-6 h-6" />
      </button>
      
      <button
        onClick={() => nextSlide()}
        aria-label="Next slide"
        className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 md:w-10 md:h-10 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center transition-all z-20"
      >
        <FiChevronRight className="text-white w-6 h-6" />
      </button>

{/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
        {displayCategories.map((_, index) => (
          <button
            key={index}
            onClick={(e) => goToSlide(e, index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-2 rounded-full transition-all duration-[425ms] ${
              index === safeDisplayIndex ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  )
}