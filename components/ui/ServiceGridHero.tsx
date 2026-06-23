'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'
import { getImageUrl } from '@/lib/images'

interface HeroService {
  id: string
  title: string
  slug: string
  description: string | null
  image: string | null
  price: number | null
  duration: number | null
}

interface HeroCategory {
  id: string
  name: string
  slug: string
  description: string
  icon: string | null
  image: string | null
  services: HeroService[]
}

interface ServiceGridHeroProps {
  categories: HeroCategory[]
}

export default function ServiceGridHero({ categories }: ServiceGridHeroProps) {
  const [active, setActive] = useState<string>(categories[0]?.slug || '')

  const activeCat = categories.find((c) => c.slug === active)
  const services = activeCat?.services?.slice(0, 4) || []

  const handleBook = (service: HeroService) => {
    localStorage.setItem(
      'selectedService',
      JSON.stringify({
        id: service.id,
        name: service.title,
        price: service.price,
        category: activeCat?.name || '',
        categoryId: activeCat?.id || '',
      })
    )
    window.location.href = `/booking?serviceId=${service.id}&category=${activeCat?.slug || ''}`
  }

  return (
    <div className="bg-card rounded-3xl border border-border p-4 md:p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
          Our Services
        </span>
        <Link
          href="/services"
          className="text-[10px] font-medium text-amber-600 hover:text-amber-700 flex items-center gap-0.5"
        >
          View all <FiArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {categories.slice(0, 8).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActive(cat.slug)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-all whitespace-nowrap ${
              active === cat.slug
                ? 'bg-amber-500 text-ink'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {services.length > 0 && (
        <div className="space-y-1.5">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-amber-soft/40 transition-colors cursor-pointer"
              onClick={() => handleBook(svc)}
            >
              <div className="size-9 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {svc.image ? (
                  <img
                    src={getImageUrl(svc.image)}
                    alt={svc.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    {svc.title.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-ink truncate group-hover:text-amber-600 transition-colors">
                  {svc.title}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {svc.price ? `LKR ${svc.price.toLocaleString()}` : 'View pricing'}
                </p>
              </div>
              <button className="text-[10px] font-semibold text-ink bg-amber-500 hover:bg-amber-600 px-2.5 py-1 rounded-full transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                Book
              </button>
            </div>
          ))}
        </div>
      )}

      {services.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Select a category above
        </p>
      )}
    </div>
  )
}
