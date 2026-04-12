'use client'

import { useState } from 'react'
import { FiTool, FiImage, FiPackage, FiStar, FiCloud, FiZap, FiTrendingUp } from 'react-icons/fi'

interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
}

interface CategoryPillsProps {
  categories: Category[]
  selectedCategory: string | null
  onSelectCategory: (slug: string | null) => void
}

const iconMap: Record<string, React.ReactNode> = {
  wrench: <FiTool className="w-5 h-5" />,
  image: <FiImage className="w-5 h-5" />,
  package: <FiPackage className="w-5 h-5" />,
  sparkles: <FiStar className="w-5 h-5" />,
  tree: <FiCloud className="w-5 h-5" />,
  plug: <FiZap className="w-5 h-5" />,
  trending: <FiTrendingUp className="w-5 h-5" />,
}

export default function CategoryPills({ categories, selectedCategory, onSelectCategory }: CategoryPillsProps) {
  return (
    <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
      <div className="flex gap-3 min-w-max px-4">
        <button
          onClick={() => onSelectCategory(null)}
          className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all duration-300 whitespace-nowrap ${
            selectedCategory === null
              ? 'bg-primary-500 text-dark-900 shadow-lg shadow-primary-500/30'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <span>All Services</span>
        </button>
        
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelectCategory(category.slug)}
            className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all duration-300 whitespace-nowrap ${
              selectedCategory === category.slug
                ? 'bg-primary-500 text-dark-900 shadow-lg shadow-primary-500/30'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {iconMap[category.icon || 'wrench'] || <FiStar className="w-5 h-5" />}
            <span>{category.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
