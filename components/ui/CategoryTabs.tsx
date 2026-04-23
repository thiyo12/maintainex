'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  _count?: { services: number }
}

interface CategoryTabsProps {
  categories: Category[]
  selectedCategory?: string
}

export default function CategoryTabs({ 
  categories, 
  selectedCategory 
}: CategoryTabsProps) {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState(selectedCategory || '')

  const handleCategoryClick = (slug: string) => {
    setActiveCategory(slug)
    
    // Scroll to services section
    const servicesSection = document.getElementById('services-section')
    if (servicesSection) {
      servicesSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="w-full overflow-x-auto scrollbar-hide pb-2">
      <div className="flex gap-2 px-4 min-w-max">
        {/* All Services Tab */}
        <button
          onClick={() => {
            setActiveCategory('')
            // Show all services - scroll to section without filtering
            const servicesSection = document.getElementById('services-section')
            if (servicesSection) {
              servicesSection.scrollIntoView({ behavior: 'smooth' })
            }
          }}
          className={`flex-shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
            activeCategory === ''
              ? 'bg-primary-500 text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          All Services
        </button>

        {/* Category Tabs */}
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.slug)}
            className={`flex-shrink-0 px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
              activeCategory === category.slug
                ? 'bg-primary-500 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {category.name}
            {category._count?.services ? (
              <span className="ml-1 text-xs opacity-75">
                ({category._count.services})
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}