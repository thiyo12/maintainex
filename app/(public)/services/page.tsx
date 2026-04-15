import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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
        <section className="bg-gradient-to-br from-primary-400 to-primary-600 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-dark-900 mb-6">
              Our Services
            </h1>
            <p className="text-xl text-dark-900/80 max-w-3xl mx-auto">
              Professional cleaning services tailored to your needs. From home cleaning to commercial spaces, we've got you covered.
            </p>
          </div>
        </section>

        {/* Services Grid */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {categories.map((category) => (
              <div key={category.id} className="mb-16">
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-2xl md:text-3xl font-bold text-dark-900">
                    {category.name}
                  </h2>
                  <div className="flex-1 h-0.5 bg-primary-200"></div>
                </div>
                
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {category.services.map((service) => (
                    <div 
                      key={service.id} 
                      className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
                    >
                      {service.image && (
                        <div className="h-48 overflow-hidden">
                          <img 
                            src={service.image} 
                            alt={service.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      )}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-dark-900 mb-2">
                          {service.name}
                        </h3>
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {service.description || 'Professional cleaning service'}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold text-primary-600">
                            Rs. {service.price.toLocaleString()}
                          </span>
                          <a 
                            href={`/booking?serviceId=${service.id}`}
                            className="bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold px-4 py-2 rounded-lg transition-all duration-300"
                          >
                            Book Now
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {categories.length === 0 && (
              <div className="text-center py-20">
                <p className="text-xl text-gray-600">Services coming soon!</p>
              </div>
            )}
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
                Why Choose Maintain?
              </h2>
              <p className="text-xl text-gray-600">
                Sri Lanka's most trusted cleaning service
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-gray-50 rounded-2xl">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">⭐</span>
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-3">5-Star Service</h3>
                <p className="text-gray-600">Rated #1 by hundreds of satisfied customers across Sri Lanka</p>
              </div>

              <div className="text-center p-8 bg-gray-50 rounded-2xl">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🛡️</span>
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-3">Fully Insured</h3>
                <p className="text-gray-600">Complete protection for your property and our team</p>
              </div>

              <div className="text-center p-8 bg-gray-50 rounded-2xl">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">💯</span>
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-3">100% Satisfaction</h3>
                <p className="text-gray-600">Not happy? We'll come back and clean again for free</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary-400 to-primary-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6">
              Ready to Book Your Cleaning?
            </h2>
            <p className="text-xl text-dark-900/80 mb-8">
              Get a professional clean today. Easy booking, instant confirmation.
            </p>
            <a href="/booking" className="inline-block bg-dark-900 hover:bg-dark-800 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl">
              Book Now
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
