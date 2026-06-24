export const revalidate = 60
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import dynamicImport from 'next/dynamic'
import Header from '@/components/layout/Header'
import AnimatedHero from '@/components/ui/AnimatedHero'

import AiSearchBar from '@/components/ui/AiSearchBar'
import ServiceGridHero from '@/components/ui/ServiceGridHero'
import CategoryMarquee from '@/components/ui/CategoryMarquee'
import HowItWorks from '@/components/ui/HowItWorks'

const Strands = dynamicImport(() => import('@/components/ui/Strands'), { ssr: false })
const FlashOfferSplash = dynamicImport(() => import('@/components/ui/FlashOfferSplash'), { ssr: false })
const WelcomeBanner = dynamicImport(() => import('@/components/ui/WelcomeBanner'), { ssr: false })
const WhatsAppButton = dynamicImport(() => import('@/components/layout/WhatsAppButton'), { ssr: false })
const HomeServices = dynamicImport(() => import('@/components/ui/HomeServices'))
const TrendingServices = dynamicImport(() => import('@/components/ui/TrendingServices'))
const CTASection = dynamicImport(() => import('@/components/ui/CTASection'))
const HomeFaqSection = dynamicImport(() => import('@/components/ui/HomeFaqSection'))
const Footer = dynamicImport(() => import('@/components/layout/Footer'))
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const c = REGIONS[host.includes('ca.') ? 'CA' : 'LK'].countryName
  return {
    title: `Find Taskers for Any Job in ${c} | Maintainex ${c}`,
    description: `${c}'s local marketplace for everyday tasks. Post a job, get matched with trusted taskers near you — cleaning, repairs, moving, handyman & more. Free quotes, no sign-up needed.`,
    openGraph: {
      title: `Find Taskers for Any Job in ${c}`,
      description: `Post any task and connect with local taskers. Free quotes, trusted professionals, no sign-up needed.`,
    },
  }
}
import { Quote } from 'lucide-react'
import { FiArrowRight } from 'react-icons/fi'
import { prisma } from '@/lib/prisma'

async function getServicesByCategory() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' }
  })
  
  const allServices = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' }
  })
  
  const categoriesWithServices = categories.map(cat => {
    const catServices = allServices
      .filter(svc => svc.categoryId === cat.id)
      .map(svc => ({
        id: svc.id,
        title: svc.name,
        slug: svc.slug || '',
        description: svc.description,
        image: svc.image,
        price: svc.price ? Number(svc.price) : null,
        duration: svc.duration ? Number(svc.duration) : null
      }))
    
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      icon: cat.icon,
      image: cat.image,
      isActive: cat.isActive,
      services: catServices
    }
  }) as any[]
  
  const services = allServices.map(svc => ({
    id: svc.id,
    title: svc.name,
    slug: svc.slug || '',
    description: svc.description,
    image: svc.image,
    name: svc.name,
    price: svc.price ? Number(svc.price) : null,
    duration: svc.duration ? Number(svc.duration) : null,
    views: svc.views || 0,
    isTrending: svc.isTrending || false
  })) as any[]
  
  return { categories: categoriesWithServices, services }
}

const BASE_DATE = new Date('2025-01-01')

function fifteenMinIntervals(): number {
  const diff = Date.now() - BASE_DATE.getTime()
  return Math.floor(diff / (1000 * 60 * 15))
}

function twoHourIntervals(): number {
  const diff = Date.now() - BASE_DATE.getTime()
  return Math.floor(diff / (1000 * 60 * 120))
}

function getViewCount(seed: number = 0): number {
  return Math.floor(Math.random() * 5001) + 3000
}

async function getTrendingServices() {
  const trending = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: [
      { isTrending: 'desc' },
      { views: 'desc' }
    ],
    take: 5
  })
  
  return trending.map((svc, index) => ({
    id: svc.id,
    name: svc.name,
    slug: svc.slug,
    description: svc.description,
    image: svc.image,
    price: svc.price ? Number(svc.price) : null,
    duration: svc.duration ? Number(svc.duration) : null,
    views: getViewCount(index),
    isTrending: svc.isTrending || false
  })) as any[]
}

export default async function HomePage() {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const c = REGIONS[regionKey].countryName

  const { categories = [], services = [] } = await getServicesByCategory()
  const trendingServices = await getTrendingServices()

  const happyClients = 500 + twoHourIntervals() * 2
  const transactions = 1000 + twoHourIntervals() * 2

  return (
    <>
      <FlashOfferSplash />
      <WelcomeBanner />
      <Header />
      <WhatsAppButton />
      
      <main className="pt-16">
        <section className="relative min-h-[70vh] flex items-center overflow-hidden bg-background">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[300px] md:w-[560px] h-[300px] md:h-[560px] bg-amber-500/20 rounded-full blur-3xl animate-breathe" />
            <div className="absolute -bottom-40 -left-40 w-[250px] md:w-[400px] h-[250px] md:h-[400px] bg-indigo-400/15 rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-24 relative z-10 w-full">
              <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 order-2 lg:order-1">
                <AnimatedHero />
                
                <p className="text-base md:text-lg text-muted-foreground mb-6 max-w-lg mt-6 animate-fade-up">
                  Sri Lanka&apos;s trusted local marketplace. Post a job, get matched with vetted taskers within 50 km, and receive quotes in minutes.
                </p>

                <div className="relative overflow-hidden rounded-2xl animate-fade-up" style={{ animationDelay: '0.2s', height: '400px' }}>
                  <Strands
                    colors={["#F97316","#7C3AED","#06B6D4"]}
                    count={3}
                    speed={0.4}
                    amplitude={0.6}
                    waviness={0.8}
                    thickness={0.5}
                    glow={1.2}
                    taper={3}
                    spread={0.8}
                    intensity={0.4}
                    saturation={1.5}
                    opacity={0.9}
                    scale={0.7}
                    glass={false}
                    refraction={1}
                    dispersion={1}
                    glassSize={1}
                    hueShift={0}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <AiSearchBar services={services.map(s => ({ title: s.title, slug: s.slug }))} />
                  </div>
                </div>

                <div className="lg:hidden mt-6 animate-fade-up" style={{ animationDelay: '0.25s' }}>
                  <ServiceGridHero categories={categories} />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 animate-fade-up" style={{ animationDelay: '0.3s' }}>
                  <Link href="/booking" className="glow-amber inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-6 py-3 rounded-full text-sm transition-all active:scale-95">
                    Book a Service <FiArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/services" className="inline-flex items-center gap-2 text-foreground font-medium px-6 py-3 rounded-full border border-border hover:border-amber-300 text-sm transition-all">
                    View Services
                  </Link>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 mt-10 animate-fade-up" style={{ animationDelay: '0.4s' }}>
                  <div className="flex -space-x-2">
                    <div className="size-8 rounded-full bg-amber-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-background">PK</div>
                    <div className="size-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-background">MR</div>
                    <div className="size-8 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-background">SD</div>
                    <div className="size-8 rounded-full bg-rose-500 flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-background">+</div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-ink font-bold">{happyClients.toLocaleString()}+</strong> taskers across Colombo, Kandy, Galle &amp; Jaffna
                  </p>
                </div>
              </div>

              <div className="hidden lg:block lg:col-span-5 order-1 lg:order-2">
                <ServiceGridHero categories={categories} />
              </div>
            </div>
          </div>
        </section>

        <CategoryMarquee />

        <HomeServices initialCategories={categories} initialServices={services} />

        {trendingServices.length > 0 && (
          <TrendingServices services={trendingServices} />
        )}

        <HowItWorks />

        <section id="taskers" className="py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 rounded-[32px] bg-foreground text-background p-10 md:p-14 relative overflow-hidden">
                <div className="absolute top-10 right-10 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl animate-breathe" />
                <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400 font-semibold">For taskers</span>
                <h2 className="text-3xl md:text-4xl font-black tracking-[-0.03em] mt-4 max-w-md">
                  Skip the chasing.<br />
                  <span className="text-amber-400">Get paid for real work.</span>
                </h2>
                <div className="flex flex-col sm:flex-row gap-3 mt-8">
                  <Link href="/register" className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-6 py-2.5 rounded-full text-sm transition-all active:scale-95">
                    Become a tasker <FiArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/services" className="inline-flex items-center gap-2 text-background font-medium px-6 py-2.5 rounded-full border border-background/20 hover:border-background/40 text-sm transition-all">
                    List your company
                  </Link>
                </div>
                <div className="flex flex-wrap gap-6 mt-10">
                  <div>
                    <div className="text-2xl font-black text-amber-400">LKR 120k</div>
                    <div className="text-xs text-background/60">Avg. monthly</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-amber-400">4.8★</div>
                    <div className="text-xs text-background/60">Tasker rating</div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-amber-400">12 min</div>
                    <div className="text-xs text-background/60">Avg. response</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 bg-cream rounded-3xl p-8 md:p-10 border border-border flex flex-col justify-center">
                <Quote className="w-8 h-8 text-amber-500 mb-4" />
                <p className="text-lg md:text-xl leading-relaxed text-ink font-medium italic">
                  &ldquo;I found three qualified plumbers within an hour of posting. The quoting system is transparent and fair — no more back-and-forth.&rdquo;
                </p>
                <div className="flex items-center gap-3 mt-6">
                  <div className="size-10 rounded-full bg-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-700">SN</div>
                  <div>
                    <p className="text-sm font-bold text-ink">Sivapragasam R.</p>
                    <p className="text-xs text-muted-foreground">Business Owner, {c}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-foreground">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-background mb-4">
              Ready for a Cleaner Space?
            </h2>
            <p className="text-lg text-background/70 mb-8">
              Book your service today and experience the Maintainex difference.
            </p>
            <CTASection />
          </div>
        </section>

        <HomeFaqSection />
      </main>

      <Footer />
    </>
  )
}
