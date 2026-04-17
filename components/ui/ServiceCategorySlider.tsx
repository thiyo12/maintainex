'use client'

import { useState, useEffect, useCallback } from 'react'
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
  services: {
    id: string
    image: string | null
    name: string
  }[]
}

interface ServiceCategorySliderProps {
  categories: Category[]
}

export default function ServiceCategorySlider({ categories }: ServiceCategorySliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const [imageKey, setImageKey] = useState(Date.now())

  const activeCategories = categories.filter(cat => cat.services.length > 0)

  useEffect(() => {
    setImageKey(Date.now())
  }, [categories])

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % activeCategories.length)
  }, [activeCategories.length])

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + activeCategories.length) % activeCategories.length)
  }

  const goToSlide = (index: number) => {
    setCurrentIndex(index)
  }

  useEffect(() => {
    if (isPaused || isHovering) return

    const interval = setInterval(nextSlide, 2000)
    return () => clearInterval(interval)
  }, [nextSlide, isPaused, isHovering])

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPaused(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  if (activeCategories.length === 0) return null

  const getCategoryImage = (category: Category) => {
    if (category.image) return getImageUrl(category.image)
    const serviceWithImage = category.services.find(s => s.image)
    return serviceWithImage ? getImageUrl(serviceWithImage.image) : ''
  }

  const currentCategory = activeCategories[currentIndex]
  const categoryImage = getCategoryImage(currentCategory)

  return (
    <div 
      className="relative w-full h-full min-h-[500px] lg:min-h-[600px]"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="absolute -top-8 -left-8 w-full h-full bg-primary-200/30 rounded-3xl" />
      
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
        {categoryImage ? (
          <Image
            src={`${categoryImage}?t=${imageKey}`}
            alt={currentCategory.name}
            fill
            className="object-cover transition-all duration-700 ease-in-out"
            sizes="(max-width: 1024px) 0px, 50vw"
            priority
            key={imageKey}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-300 to-primary-400 flex items-center justify-center">
            <span className="text-8xl">{currentCategory.icon || '📋'}</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8">
          <Link 
            href={`/services#${currentCategory.slug}`}
            className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 lg:p-6 hover:bg-white/30 transition-all duration-300 group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl lg:text-4xl">{currentCategory.icon || '📋'}</span>
              <h3 className="text-xl lg:text-2xl font-bold text-white group-hover:text-primary-300 transition-colors">
                {currentCategory.name.toUpperCase()}
              </h3>
            </div>
            <p className="text-white/80 text-sm lg:text-base">
              {currentCategory.services.length}+ Professional Services
            </p>
            <p className="text-white/60 text-xs lg:text-sm mt-1">
              Click to explore →
            </p>
          </Link>
        </div>

        <button
          onClick={prevSlide}
          className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all duration-300"
          aria-label="Previous slide"
        >
          <FiChevronLeft className="text-white text-xl lg:text-2xl" />
        </button>

        <button
          onClick={nextSlide}
          className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-12 lg:h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/40 transition-all duration-300"
          aria-label="Next slide"
        >
          <FiChevronRight className="text-white text-xl lg:text-2xl" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {activeCategories.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 lg:w-3 lg:h-3 rounded-full transition-all duration-300 ${
                index === currentIndex 
                  ? 'bg-white w-6 lg:w-8' 
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {isHovering && (
          <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-white text-xs">⏸️ Paused</span>
          </div>
        )}
      </div>
    </div>
  )
}
