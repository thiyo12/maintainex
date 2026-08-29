'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import GradualBlur from '@/components/ui/GradualBlur'
import { getImageUrl } from '@/lib/images'
import {
  Sparkles, Zap, Droplet, Paintbrush, Wrench, Leaf, Monitor, Hammer,
  Bug, Snowflake, Droplets, Shield, Truck, Home, type LucideIcon,
} from 'lucide-react'

interface Service {
  id: string
  title: string
  slug: string | null
  description: string
  image: string | null
  price: number | null
  duration: number | null
  categoryId: string
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  image: string | null
  displayOrder: number
  serviceCount: number
  services: Service[]
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  cleaning: Sparkles,
  electrical: Zap,
  plumbing: Droplet,
  painting: Paintbrush,
  repairs: Wrench,
  gardening: Leaf,
  'web-design': Monitor,
  assembly: Hammer,
  mounting: Hammer,
  'pest-control': Bug,
  'ac-service': Snowflake,
  'water-tank-cleaning': Droplets,
  'water-tank': Droplets,
  disinfection: Shield,
  moving: Truck,
  homecare: Home,
}

function getCategoryIcon(slug: string, name: string): LucideIcon {
  const lower = slug.toLowerCase()
  if (CATEGORY_ICONS[lower]) return CATEGORY_ICONS[lower]
  const byName = name.toLowerCase()
  if (byName.includes('clean')) return Sparkles
  if (byName.includes('electr')) return Zap
  if (byName.includes('plumb')) return Droplet
  if (byName.includes('paint')) return Paintbrush
  if (byName.includes('repair') || byName.includes('mainten')) return Wrench
  if (byName.includes('garden') || byName.includes('lawn')) return Leaf
  if (byName.includes('web') || byName.includes('design')) return Monitor
  if (byName.includes('assemb') || byName.includes('mount')) return Hammer
  if (byName.includes('pest')) return Bug
  if (byName.includes('ac') || byName.includes('air')) return Snowflake
  if (byName.includes('tank') || byName.includes('water')) return Droplets
  if (byName.includes('disinf') || byName.includes('sanit')) return Shield
  if (byName.includes('move') || byName.includes('shift')) return Truck
  if (byName.includes('home') || byName.includes('house')) return Home
  return Sparkles
}

export default function ServicesPage({ cityName }: { cityName?: string }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    }>
      <ServicesContent cityName={cityName} />
    </Suspense>
  )
}

function ServicesContent({ cityName }: { cityName?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategorySlug(categoryParam)
    }
  }, [categoryParam])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = categories.find(c => c.slug === selectedCategorySlug)
  const firstService = selectedCategory?.services?.[0]

  const handleCategoryClick = (category: Category) => {
    setSelectedCategorySlug(category.slug)
  }

  const handleBookNow = (category: Category) => {
    const firstSvc = category.services?.[0]
    if (firstSvc) {
      localStorage.setItem('selectedService', JSON.stringify({
        id: firstSvc.id,
        name: firstSvc.title,
        price: firstSvc.price,
        category: category.name,
        categoryId: category.id
      }))
      router.push('/waitlist')
    }
  }

  useEffect(() => {
    if (selectedCategorySlug || categoryParam) {
      const meta = document.querySelector('meta[name="robots"]')
      if (!meta) {
        const tag = document.createElement('meta')
        tag.name = 'robots'
        tag.content = 'noindex, follow'
        document.head.appendChild(tag)
      } else {
        meta.setAttribute('content', 'noindex, follow')
      }
    }
  }, [selectedCategorySlug, categoryParam])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-16 min-h-screen bg-background">
        {/* Hero Section */}
        <section className="bg-foreground py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <h1 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-background mb-3 text-center">
              {cityName ? `Services in ${cityName}` : 'Our Services'}
            </h1>
            {selectedCategory && (
              <div className="flex justify-center mb-4">
                <button 
                  onClick={() => {
                    router.push('/services')
                  }}
                  className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-2"
                >
                  ← View All Categories
                </button>
              </div>
            )}
            {selectedCategory && (
              <p className="text-background/80 text-center max-w-2xl mx-auto mb-6">
                {selectedCategory.services?.length || 0} services in {selectedCategory.name}
              </p>
            )}
            {!selectedCategory && (
            <p className="text-background/80 text-center max-w-2xl mx-auto mb-6">
              {cityName
                ? `Professional home services in ${cityName}. Choose a service to get started.`
                : `Professional home services at your fingertips. Choose a service to get started.`}
            </p>
            )}
          </div>
        </section>

        {/* ALL Services Grid - Grouped by Category */}
        {!selectedCategorySlug && (
        <section id="all-services" className="py-8 md:py-12">
          <div
            className="max-w-7xl mx-auto px-5 sm:px-8 relative"
            style={{ height: '520px', overflow: 'hidden' }}
          >
            <div className="h-full overflow-y-auto pb-16">
              {categories.map((category) => (
                category.services && category.services.length > 0 && (
                  <div key={category.id} className="mb-12">
                    <div className="flex items-center gap-3 mb-6">
                      {(() => {
                        const Icon = getCategoryIcon(category.slug, category.name)
                        return <Icon className="w-6 h-6 text-amber-500" />
                      })()}
                      <h2 className="text-xl md:text-2xl font-bold text-foreground">
                        {category.name}
                      </h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {category.services.map((service) => (
                        <div 
                          key={service.id}
                          className="bg-card rounded-3xl overflow-hidden border border-border hover:border-amber-300 transition-all duration-300"
                        >
                          <div className="relative h-28 md:h-32 overflow-hidden bg-muted">
                            {service.image ? (
                              <img
                                src={getImageUrl(service.image)}
                                alt={service.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-amber-soft flex items-center justify-center">
                                <span className="text-4xl">🧹</span>
                              </div>
                            )}
                          </div>

                          <div className="p-4">
                            <h3 className="font-bold text-foreground mb-1">
                              {service.title}
                            </h3>
                            <p className="text-muted-foreground text-sm mb-2 line-clamp-2">
                              {service.description || 'Professional service'}
                            </p>

                            <div className="flex gap-2">
                              {service.slug && (
                                <Link
                                  href={`/services/${service.slug}`}
                                  className="flex-1 text-center bg-muted hover:bg-muted/80 text-foreground font-semibold py-2.5 rounded-full transition-colors text-sm"
                                >
                                  Learn More
                                </Link>
                              )}
                              <button 
                                onClick={() => {
                                  localStorage.setItem('selectedService', JSON.stringify({
                                    id: service.id,
                                    name: service.title,
                                    price: service.price,
                                    category: category.name
                                  }))
                                  router.push('/waitlist')
                                }}
                                className={`${service.slug ? 'flex-1' : 'w-full'} bg-amber-500 hover:bg-amber-600 text-ink font-semibold py-2.5 rounded-full transition-colors text-sm`}
                              >
                                Book Now
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
            <GradualBlur
              target="parent"
              position="bottom"
              height="7rem"
              strength={2}
              divCount={5}
              curve="bezier"
              exponential
              opacity={1}
            />
          </div>
        </section>
        )}
      </main>

      <Footer />
    </>
  )
}
