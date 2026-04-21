'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
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

  const activeCategories = categories.map((cat, idx) => ({
    ...cat,
    image: cat.image || defaultCategoryImages[idx % defaultCategoryImages.length]
  }))

  useEffect(() => {
    const length = activeCategories.length
    if (length === 0) return

    const interval = setInterval(() => {
      if (!isHovering) {
        setCurrentIndex(prev => (prev + 1) % length)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [activeCategories.length, isHovering])

  const nextSlide = () => { setCurrentIndex(prev => (prev + 1) % activeCategories.length) }
  const prevSlide = () => { setCurrentIndex(prev => (prev - 1 + activeCategories.length) % activeCategories.length) }
  const goToSlide = (index: number) => { 
    if (index >= 0 && index < activeCategories.length) {
      setCurrentIndex(index) 
    }
  }

  // Ensure currentIndex is valid
  const safeCurrentIndex = activeCategories.length > 0 && currentIndex >= 0 ? currentIndex % activeCategories.length : 0

  if (activeCategories.length === 0) {
return (
    <div className="w-full min-h-[200px] aspect-video bg-gradient-to-br from-primary-300 to-primary-500 rounded-2xl flex items-center justify-center">
        <p className="text-white font-medium">Loading services...</p>
      </div>
    )
  }

  const currentCategory = activeCategories[safeCurrentIndex]
  const getCategoryImage = (cat: typeof currentCategory, idx: number) => {
    if (cat.image) {
      if (cat.image.startsWith('http') || cat.image.startsWith('data:')) return cat.image
      if (cat.image.startsWith('/uploads/') || cat.image.startsWith('/')) return getImageUrl(cat.image)
    }
    return defaultCategoryImages[idx % defaultCategoryImages.length]
  }
  const categoryImage = getCategoryImage(currentCategory, safeCurrentIndex)

  return (
    <div 
      className="relative w-full h-auto max-h-[70vh] aspect-video"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="absolute -top-2 -left-2 w-full h-full bg-primary-200/30 rounded-2xl" />
      
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
        <Link href={`/services?category=${currentCategory.slug}`} className="block w-full h-full">
          {categoryImage ? (
            <img
              src={categoryImage}
              alt={currentCategory.name || 'Service Category'}
              className="w-full h-full object-cover object-center"
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
          onClick={prevSlide}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center transition-all duration-[600ms] hover:bg-white/40"
        >
          <FiChevronLeft className="text-white" />
        </button>
        
        <button
          onClick={nextSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center transition-all duration-[600ms] hover:bg-white/40"
        >
          <FiChevronRight className="text-white" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {activeCategories.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all duration-[425ms] ${
                index === safeCurrentIndex ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}