'use client'

import { useState, useEffect } from 'react'

interface Industry {
  id: string
  name: string
  icon: string | null
  image: string | null
  displayOrder: number
}

export default function IndustriesCarousel() {
  const [industries, setIndustries] = useState<Industry[]>([])

  useEffect(() => {
    fetch('/api/industries')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setIndustries(data)
        }
      })
      .catch(console.error)
  }, [])

  return (
    <div className="relative w-full overflow-x-auto">
      <div className="flex animate-scroll gap-4 md:gap-6 w-max justify-start md:justify-center px-2 md:px-0">
        {industries.length > 0 ? (
          <>
            {industries.map((industry) => {
              const imgSrc = industry.image && industry.image.startsWith('/uploads/') 
                ? `/api/files${industry.image}`
                : industry.image || ''
              return (
              <div key={industry.id} className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                <div className="h-32 md:h-40 overflow-hidden bg-gray-100">
                  {industry.image && industry.image.length > 10 ? (
                    <img
                      src={imgSrc}
                      alt={industry.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                      <span className="text-4xl">{industry.icon || '🏢'}</span>
                    </div>
                  )}
                </div>
                <div className="p-4 text-center">
                  <h4 className="font-semibold text-dark-900">{industry.name}</h4>
                </div>
              </div>
              )
            })}
            {industries.map((industry) => {
              const imgSrc = industry.image && industry.image.startsWith('/uploads/') 
                ? `/api/files${industry.image}`
                : industry.image || ''
              return (
              <div key={`${industry.id}-dup`} className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                <div className="h-32 md:h-40 overflow-hidden bg-gray-100">
                  {industry.image && industry.image.length > 10 ? (
                    <img
                      src={imgSrc}
                      alt={industry.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                      <span className="text-4xl">{industry.icon || '🏢'}</span>
                    </div>
                  )}
                </div>
                <div className="p-4 text-center">
                  <h4 className="font-semibold text-dark-900">{industry.name}</h4>
                </div>
              </div>
              )
            })}
          </>
        ) : (
          /* Fallback when no industries data */
          <>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <span className="text-4xl">🏬</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Shopping Malls</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                <span className="text-4xl">🏫</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Schools</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                <span className="text-4xl">🏠</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Real Estate</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                <span className="text-4xl">🏥</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Hospitals</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <span className="text-4xl">🏭</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Industrial</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                <span className="text-4xl">🏢</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Office</h4>
              </div>
            </div>
            {/* Duplicates */}
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                <span className="text-4xl">🏬</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Shopping Malls</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-yellow-100 to-yellow-200 flex items-center justify-center">
                <span className="text-4xl">🏫</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Schools</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                <span className="text-4xl">🏠</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Real Estate</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                <span className="text-4xl">🏥</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Hospitals</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <span className="text-4xl">🏭</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Industrial</h4>
              </div>
            </div>
            <div className="flex-shrink-0 w-48 md:w-56 bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow">
              <div className="h-32 md:h-40 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                <span className="text-4xl">🏢</span>
              </div>
              <div className="p-4 text-center">
                <h4 className="font-semibold text-dark-900">Office</h4>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}