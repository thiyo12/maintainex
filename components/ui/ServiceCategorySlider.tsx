'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'

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

  const activeCategories = categories.filter(cat => cat.isActive !== false && cat.isActive !== null)

  useEffect(() => {
    if (activeCategories.length === 0) return

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % activeCategories.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [activeCategories.length])

  const nextSlide = () => setCurrentIndex(prev => (prev + 1) % activeCategories.length)
  const prevSlide = () => setCurrentIndex(prev => (prev - 1 + activeCategories.length) % activeCategories.length)
  const goToSlide = (index: number) => setCurrentIndex(index)

  if (activeCategories.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center bg-gray-100 rounded-2xl">
        <p className="text-gray-500">No categories available</p>
      </div>
    )
  }

  const currentCategory = activeCategories[currentIndex]
  const categoryImage = currentCategory.image ? getImageUrl(currentCategory.image) : null

  return (
    <div 
      className="relative w-full aspect-[16/9] sm:aspect-[2/1] md:aspect-[21/9] lg:aspect-[3/1]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="absolute -top-2 -left-2 w-full h-full bg-primary-200/30 rounded-2xl" />
      
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
        {categoryImage ? (
          <Image
            src={categoryImage}
            alt={currentCategory.name}
            fill
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-300 to-primary-500 flex items-center justify-center">
            <span className="text-5xl sm:text-6xl md:text-7xl">{currentCategory.icon || '📋'}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

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
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center"
        >
          <FiChevronLeft className="text-white" />
        </button>
        
        <button
          onClick={nextSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center"
        >
          <FiChevronRight className="text-white" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {activeCategories.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-5' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}