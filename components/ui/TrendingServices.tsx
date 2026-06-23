'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { MapPin, Star, ArrowRight } from 'lucide-react'
import { FiArrowRight as FiArrowRightOld } from 'react-icons/fi'

interface Service {
  id: string
  name: string
  slug: string | null
  description: string
  price: number | null
  duration: number | null
  image: string | null
  views: number
  isTrending: boolean
}

interface TrendingServicesProps {
  services: Service[]
}

const JOB_CATEGORIES = ['Cleaning', 'Plumbing', 'Web Design', 'Painting', 'Electrical', 'Repairs']
const LOCATIONS = ['Colombo 03', 'Colombo 05', 'Kandy', 'Galle', 'Jaffna', 'Negombo']
const TIMES = ['Today', 'Urgent', 'This week', 'Weekend', 'Tomorrow']
const QUOTES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

export default function TrendingServices({ services }: TrendingServicesProps) {
  const [visible, setVisible] = useState<Set<number>>(new Set())
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([])

  useEffect(() => {
    if (!services?.length) return
    cardRefs.current = cardRefs.current.slice(0, services.length)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            if (!isNaN(index)) {
              setVisible((prev) => new Set(prev).add(index))
            }
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
    )

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [services])

  if (!services || services.length === 0) return null

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-600 font-semibold">Live now</span>
            <h2 className="text-3xl md:text-4xl font-black tracking-[-0.03em] text-ink mt-1">
              Jobs posted today
            </h2>
          </div>
          <Link
            href="/services"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-amber-600 transition-colors"
          >
            Browse all <FiArrowRightOld className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 md:gap-5">
          {services.map((service, index) => {
            const isVisible = visible.has(index)
            const cat = pick(JOB_CATEGORIES, index)
            const isRemote = cat === 'Web Design'
            const location = isRemote ? 'Remote' : pick(LOCATIONS, index)
            const time = pick(TIMES, index)

            return (
              <Link
                key={service.id}
                data-index={index}
                ref={(el) => { cardRefs.current[index] = el }}
                href={`/services/${service.slug || service.id}`}
                className={`group bg-card rounded-3xl overflow-hidden border border-border hover:border-amber-300 transition-all duration-300 ${
                  isVisible ? 'animate-fade-up' : 'opacity-0'
                }`}
                style={{
                  animationDelay: `${index * 120}ms`,
                  animationDuration: '700ms',
                  animationFillMode: 'both',
                }}
              >
                <div className="flex">
                  <div className={`w-1.5 flex-shrink-0 ${isRemote ? 'bg-indigo-400' : 'bg-amber-500'}`} />
                  <div className="flex-1 p-4 md:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-soft px-2 py-0.5 rounded-full">
                        {cat}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{time}</span>
                    </div>
                    <h3 className="font-bold text-ink text-sm md:text-base mb-3 line-clamp-1 group-hover:text-amber-600 transition-colors">
                      {service.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span className="text-xs font-semibold text-ink">{pick(QUOTES, index)}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-base font-bold text-ink">
                        {service.price ? `LKR ${service.price.toLocaleString()}` : 'From LKR 2,000'}
                      </span>
                      <span className="text-xs text-muted-foreground group-hover:text-amber-600 transition-colors">
                        {service.views} views
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        <div className="text-center mt-8 sm:hidden">
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-amber-600 transition-colors"
          >
            Browse all <FiArrowRightOld className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
