'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'

const defaultCategoryImages = [
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200',
  'https://images.unsplash.com/photo-1607400201889-565b1ee75f8e?w=1200', 
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200',
  'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=1200',
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=1200',
  'https://images.unsplash.com/photo-1563453392312-cef7d3fe93d1?w=1200',
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1200',
  'https://images.unsplash.com/photo-1585232004423-244e0e62b3a1?w=1200',
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
  const [imgError, setImgError] = useState(false)
  const [imgLoading, setImgLoading] = useState(true)

  const activeCategories = categories.filter(cat => cat.isActive !== false && cat.isActive !== null).map((cat, idx) => ({
    ...cat,
    image: cat.image || defaultCategoryImages[idx % defaultCategoryImages.length]
  }))

  useEffect(() => {
    if (activeCategories.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeCategories.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [activeCategories.length])

  const nextSlide = () => { setImgLoading(true); setImgError(false); setCurrentIndex(prev => (prev + 1) % activeCategories.length) }
  const prevSlide = () => { setImgLoading(true); setImgError(false); setCurrentIndex(prev => (prev - 1 + activeCategories.length) % activeCategories.length) }
  const goToSlide = (index: number) => { setImgLoading(true); setImgError(false); setCurrentIndex(index) }

  if (activeCategories.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-100 rounded-2xl">
        <p className="text-gray-500">No categories available</p>
      </div>
    )
  }

  const currentCategory = activeCategories[currentIndex]
  const getCategoryImage = (cat: typeof currentCategory) => {
    if (cat.image?.startsWith('http')) return cat.image
    if (cat.image) return getImageUrl(cat.image)
    return defaultCategoryImages[0]
  }
  const categoryImage = !imgError ? getCategoryImage(currentCategory) : null

  return (
    <div 
      className="relative w-full h-48 sm:h-64 md:h-80 lg:h-[500px] xl:h-[600px]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="absolute -top-2 -left-2 w-full h-full bg-primary-200/30 rounded-2xl" />
      
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
        {imgLoading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {categoryImage ? (
          <Image
            key={currentIndex}
            src={categoryImage}
            alt={currentCategory.name}
            fill
            priority
            className={`object-cover transition-opacity duration-[275ms] ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
            sizes="100vw"
            onLoad={() => setImgLoading(false)}
            onError={() => { setImgError(true); setImgLoading(false); }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center">
            <span className="text-5xl sm:text-6xl md:text-7xl">{currentCategory.icon || '📋'}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-[275ms]" />

        <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6">
          <Link 
            href={`/services#${currentCategory.slug}`}
            className="bg-white/20 backdrop-blur-sm rounded-xl p-3 md:p-4 hover:bg-white/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl md:text-3xl">{currentCategory.icon || '📋'}</span>
              <h3 className="text-lg md:text-xl font-bold text-white">
                {currentCategory.name?.toUpperCase()}
              </h3>
            </div>
            <p className="text-white/70 text-sm">Click to explore</p>
          </Link>
        </div>

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
                index === currentIndex ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}