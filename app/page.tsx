export const revalidate = 60
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import dynamicImport from 'next/dynamic'
import Header from '@/components/layout/Header'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import AnimatedHero from '@/components/ui/AnimatedHero'
import FlashOfferBanner from '@/components/ui/FlashOfferBanner'
import ServiceCategorySlider from '@/components/ui/ServiceCategorySlider'

const FlashOfferSplash = dynamicImport(() => import('@/components/ui/FlashOfferSplash'), { ssr: false })
const WelcomeBanner = dynamicImport(() => import('@/components/ui/WelcomeBanner'), { ssr: false })
const WhatsAppButton = dynamicImport(() => import('@/components/layout/WhatsAppButton'), { ssr: false })
const HomeServices = dynamicImport(() => import('@/components/ui/HomeServices'))
const TrendingServices = dynamicImport(() => import('@/components/ui/TrendingServices'))
const CTASection = dynamicImport(() => import('@/components/ui/CTASection'))
const Footer = dynamicImport(() => import('@/components/layout/Footer'))
import Link from 'next/link'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const c = REGIONS[host.includes('ca.') ? 'CA' : 'LK'].countryName
  return {
    title: `Professional Cleaning & Home Services in ${c} | Maintainex ${c}`,
    description: `${c}'s #1 professional cleaning and home maintenance services. Book online for home cleaning, office cleaning, deep cleaning and more. Free quote!`,
    openGraph: {
      title: `Maintainex ${c} - Professional Cleaning & Home Services`,
      description: `Book ${c}'s top cleaning services online. Free quotes, trusted professionals.`,
    },
  }
}
import Image from 'next/image'
import { FiCheck, FiClock, FiShield, FiStar, FiArrowRight } from 'react-icons/fi'
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

function randomViews() {
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
  
  return trending.map(svc => ({
    id: svc.id,
    name: svc.name,
    slug: svc.slug,
    description: svc.description,
    image: svc.image,
    price: svc.price ? Number(svc.price) : null,
    duration: svc.duration ? Number(svc.duration) : null,
    views: randomViews(),
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

  const features = [
    { icon: FiCheck, title: 'Professional Team', description: 'Trained and vetted cleaning professionals' },
    { icon: FiClock, title: 'Flexible Scheduling', description: 'Book at your convenience, any day, any time' },
    { icon: FiShield, title: 'Insured Service', description: 'Fully insured with satisfaction guarantee' },
    { icon: FiStar, title: '5-Star Reviews', description: 'Trusted by hundreds of satisfied customers' },
  ]

  const testimonials = [
    {
      name: 'Sivapragasam R.',
      role: `Business Owner, ${c}`,
      content: 'Maintainex transformed our office space. Their team is professional, punctual, and thorough. Highly recommended!',
      rating: 5
    },
    {
      name: 'Kumari S.',
      role: `Homeowner, Colombo`,
      content: `Best cleaning service in ${c}! They deep cleaned my entire house before my daughters wedding. Immaculate work.`,
      rating: 5
    },
    {
      name: 'Raj Traders',
      role: 'Retail Shop, Main Street',
      content: 'Reliable and affordable. Our store looks brand new after every visit. They handle everything with care.',
      rating: 5
    }
  ]

  return (
    <>
      <FlashOfferSplash />
      <WelcomeBanner />
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        <section className="relative min-h-[50vh] md:min-h-[90vh] flex items-center gradient-bg overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 right-10 w-72 h-72 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute bottom-20 left-10 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 lg:py-20 relative z-10">
            <div className="grid lg:grid-cols-2 gap-6 md:gap-10 lg:gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-3 md:px-4 py-1.5 md:py-2 mb-4 md:mb-8">
                  <span className="text-dark-900 mr-2">✨</span>
                  <span className="text-dark-900 font-medium text-sm md:text-base">#1 Service Experts in {c}</span>
                </div>
                
                <AnimatedHero />
                
                <p className="text-base md:text-xl text-dark-900/80 mb-6 md:mb-8 mt-4 md:mt-8 max-w-lg">
                  One Partner for All Your Property Maintenance Needs
                </p>
                
                {/* Mobile: Services Slider - Below Hero Text, Above Buttons */}
                <div className="lg:hidden mb-6 md:mb-8">
                  <h2 className="text-lg md:text-xl font-bold text-dark-900 mb-3 md:mb-4">Our Services</h2>
                  <ServiceCategorySlider categories={categories} />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center sm:justify-start">
                  <Link href="/booking" className="btn-secondary inline-flex items-center justify-center text-center text-sm md:text-base">
                    Book a Service <FiArrowRight className="ml-2" />
                  </Link>
                  <Link href="/services" className="bg-white/20 backdrop-blur-sm text-dark-900 font-semibold px-5 md:px-6 py-2.5 md:py-3 rounded-lg hover:bg-white/30 transition-all inline-flex items-center justify-center text-center text-sm md:text-base">
                    View Services
                  </Link>
                </div>
                
                <div className="mt-8 md:mt-12 flex flex-wrap items-center justify-center sm:justify-start gap-4 md:gap-8">
                  <div className="text-center sm:text-left">
                    <AnimatedCounter end={500} duration={3000} />
                    <div className="text-dark-900/70 text-xs md:text-sm">Happy Clients</div>
                  </div>
                  <div className="hidden sm:block h-8 md:h-12 w-px bg-dark-900/20" />
                  <div className="text-center sm:text-left">
                    <AnimatedCounter end={1000} duration={4000} />
                    <div className="text-dark-900/70 text-xs md:text-sm">Transactions</div>
                  </div>
                  <div className="hidden sm:block h-8 md:h-12 w-px bg-dark-900/20" />
                  <div className="text-center sm:text-left">
                    <AnimatedCounter end={24} suffix=":00" duration={2000} />
                    <div className="text-dark-900/70 text-xs md:text-sm">Support</div>
                  </div>
                  <div className="hidden sm:block h-8 md:h-12 w-px bg-dark-900/20" />
                  <FlashOfferBanner />
                </div>
              </div>
              
              {/* Desktop: Slider on Right Side */}
              <div className="hidden lg:block relative order-1 lg:order-2 w-full h-full min-h-[500px]">
                <ServiceCategorySlider categories={categories} />
              </div>
            </div>
          </div>
        </section>

        <HomeServices initialCategories={categories} initialServices={services} />

        {trendingServices.length > 0 && (
          <TrendingServices services={trendingServices} />
        )}

        <section className="py-24 bg-gray-50 dark:bg-dark-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-primary-600 dark:text-primary-400 font-semibold">WHY CHOOSE US</span>
              <h2 className="section-title">The Maintainex Advantage</h2>
              <p className="section-subtitle">
                We go above and beyond to ensure your space is not just clean, but exceptionally maintained.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature) => (
                <div key={feature.title} className="bg-white dark:bg-dark-400 rounded-2xl p-8 text-center shadow-lg dark:shadow-dark-900/50 hover:shadow-xl transition-shadow">
                  <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="text-dark-900 text-2xl" />
                  </div>
                  <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 bg-dark-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-primary-500 font-semibold">TESTIMONIALS</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What Our Clients Say</h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Don&apos;t just take our word for it. Here&apos;s what our satisfied customers have to say.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial) => (
                <div key={testimonial.name} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <FiStar key={i} className="text-primary-500 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-200 mb-6 italic">&ldquo;{testimonial.content}&rdquo;</p>
                  <div>
                    <div className="font-bold text-white">{testimonial.name}</div>
                    <div className="text-gray-300 text-sm">{testimonial.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 gradient-bg">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6">
              Ready for a Cleaner Space?
            </h2>
            <p className="text-xl text-dark-900/80 mb-8">
              Book your service today and experience the Maintainex difference. Shine Beyond Expectations!
            </p>
            <CTASection />
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
