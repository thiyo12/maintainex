import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import ServiceList from '@/components/ui/ServiceList'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const categoryIcons: Record<string, string> = {
  assembly: '🔧',
  mounting: '🖼️',
  moving: '📦',
  cleaning: '✨',
  outdoor: '🌿',
  repairs: '🔌',
  trending: '🔥',
  pestcontrol: '🪳',
  acservice: '❄️',
  watertank: '💧',
  disinfection: '🦠',
  homecare: '🏠',
}

export default async function ServicesPage() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      services: {
        where: { isActive: true }
      }
    },
    orderBy: { name: 'asc' }
  })

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-400 to-primary-600 py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl md:text-5xl font-bold text-dark-900 mb-4">
              Our Services
            </h1>
            <p className="text-lg md:text-xl text-dark-900/80 max-w-2xl mx-auto">
              Professional services at your fingertips. Book trusted help for any home task.
            </p>
          </div>
        </section>

        {/* Services Sections by Category */}
        <section className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {categories.map((category) => (
              <div key={category.id} className="mb-12">
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">{categoryIcons[category.slug] || '📋'}</span>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                    {category.name}
                  </h2>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {category.services.length} services
                  </span>
                </div>
                
                {/* Services Grid - 2 columns mobile, 4 columns desktop */}
                <ServiceList services={category.services} categoryName={category.name} />
              </div>
            ))}

            {categories.length === 0 && (
              <div className="text-center py-20">
                <p className="text-xl text-gray-600">Services coming soon!</p>
              </div>
            )}
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-br from-primary-400 to-primary-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-dark-900 mb-4">
              Ready to Book?
            </h2>
            <p className="text-lg text-dark-900/80 mb-6">
              Get professional help today. Easy booking, instant confirmation.
            </p>
            <a href="/booking" className="inline-block bg-dark-900 hover:bg-dark-800 text-white font-semibold px-8 py-4 rounded-xl transition-colors">
              Book Now
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
