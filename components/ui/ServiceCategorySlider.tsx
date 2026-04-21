'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'

const defaultCategoryImages = [
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%2322c55e" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3ECleaning Service%3C/text%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%2310b981" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3EHome Cleaning%3C/text%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%230d9488" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3EOffice Cleaning%3C/text%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%2314b8a6" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3EDeep Cleaning%3C/text%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%2306b6d4" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3ECarpet Cleaning%3C/text%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%233b82f6" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3EWindow Cleaning%3C/text%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%236365f1" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3EFurniture Cleaning%3C/text%3E%3C/svg%3E',
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"%3E%3Crect fill="%238b5cf6" width="1200" height="675"/%3E%3Ctext fill="white" font-family="sans-serif" font-size="48" x="50%25" y="50%25" text-anchor="middle"%3EMove In/Out%3C/text%3E%3C/svg%3E',
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

  const nextSlide = () => { setImgError(false); setCurrentIndex(prev => (prev + 1) % activeCategories.length) }
  const prevSlide = () => { setImgError(false); setCurrentIndex(prev => (prev - 1 + activeCategories.length) % activeCategories.length) }
  const goToSlide = (index: number) => { setImgError(false); setCurrentIndex(index) }
  const handleImageError = () => { setImgError(true) }

  // Ensure currentIndex is valid
  const safeCurrentIndex = activeCategories.length > 0 ? currentIndex % activeCategories.length : 0

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
      return getImageUrl(cat.image)
    }
    return defaultCategoryImages[idx % defaultCategoryImages.length]
  }
  const categoryImage = !imgError ? getCategoryImage(currentCategory, safeCurrentIndex) : null

  return (
    <div 
      className="relative w-full h-auto max-h-[70vh] aspect-video"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="absolute -top-2 -left-2 w-full h-full bg-primary-200/30 rounded-2xl" />
      
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
        <Link href={`/services#${currentCategory.slug}`} className="block w-full h-full">
          {categoryImage ? (
            <img
              src={categoryImage}
              alt={currentCategory.name}
              className="w-full h-full object-cover object-center"
              loading="lazy"
              onError={handleImageError}
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