import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import AnimatedCounter from '@/components/ui/AnimatedCounter'
import Link from 'next/link'
import { FiCheck, FiClock, FiShield, FiStar, FiArrowRight, FiHome, FiBriefcase } from 'react-icons/fi'
import { prisma } from '@/lib/prisma'

async function getServicesByCategory() {
  const categories = await prisma.category.findMany({
    include: {
      services: {
        where: { isActive: true }
      }
    },
    orderBy: { name: 'asc' }
  })
  return categories
}

export default async function HomePage() {
  const categories = await getServicesByCategory()

  const homeCleaning = categories.find(c => c.slug === 'home-cleaning')
  const industrialCleaning = categories.find(c => c.slug === 'industrial-cleaning')

  const features = [
    { icon: FiCheck, title: 'Professional Team', description: 'Trained and vetted cleaning professionals' },
    { icon: FiClock, title: 'Flexible Scheduling', description: 'Book at your convenience, any day, any time' },
    { icon: FiShield, title: 'Insured Service', description: 'Fully insured with satisfaction guarantee' },
    { icon: FiStar, title: '5-Star Reviews', description: 'Trusted by hundreds of satisfied customers' },
  ]

  const testimonials = [
    {
      name: 'Sivapragasam R.',
      role: 'Business Owner, Jaffna',
      content: 'Maintainex transformed our office space. Their team is professional, punctual, and thorough. Highly recommended!',
      rating: 5
    },
    {
      name: 'Kumari S.',
      role: 'Homeowner, Nallur',
      content: 'Best cleaning service in Jaffna! They deep cleaned my entire house before my daughters wedding. Immaculate work.',
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
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center gradient-bg overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute top-20 right-10 w-72 h-72 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                  <span className="text-dark-900 mr-2">✨</span>
                  <span className="text-dark-900 font-medium">#1 Cleaning Service in Jaffna</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-bold text-dark-900 leading-tight mb-6">
                  Shine Beyond<br/>
                  <span className="text-white">Expectations</span>
                </h1>
                <p className="text-xl text-dark-900/80 mb-8 max-w-lg">
                  Professional cleaning services for homes and businesses. Experience the difference of a truly clean space.
                </p>
                <div className="flex flex-col md:flex-row gap-4 justify-center md:justify-start">
                  <Link href="/booking" className="btn-secondary inline-flex items-center justify-center text-center">
                    Book a Cleaning <FiArrowRight className="ml-2" />
                  </Link>
                  <Link href="/services" className="bg-white/20 backdrop-blur-sm text-dark-900 font-semibold px-6 py-3 rounded-lg hover:bg-white/30 transition-all inline-flex items-center justify-center text-center">
                    View Services
                  </Link>
                </div>
                
                <div className="mt-12 flex flex-wrap items-center justify-center md:justify-start gap-6 md:gap-8">
                  <div className="text-center md:text-left">
                    <AnimatedCounter end={500} duration={3000} />
                    <div className="text-dark-900/70 text-sm md:text-base">Happy Clients</div>
                  </div>
                  <div className="hidden md:block h-12 w-px bg-dark-900/20" />
                  <div className="text-center md:text-left">
                    <AnimatedCounter end={1000} duration={4000} />
                    <div className="text-dark-900/70 text-sm md:text-base">Transactions</div>
                  </div>
                  <div className="hidden md:block h-12 w-px bg-dark-900/20" />
                  <div className="text-center md:text-left">
                    <AnimatedCounter end={24} suffix=":00" duration={2000} />
                    <div className="text-dark-900/70 text-sm md:text-base">Support</div>
                  </div>
                </div>
              </div>
              
              <div className="relative hidden lg:block">
                <div className="absolute -top-8 -left-8 w-full h-full bg-primary-200/30 rounded-3xl" />
                <img
                  src="https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800"
                  alt="Professional cleaning team"
                  className="relative rounded-3xl shadow-2xl w-full animate-float"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-primary-600 font-semibold">OUR SERVICES</span>
              <h2 className="section-title">Professional Cleaning Solutions</h2>
              <p className="section-subtitle">
                From homes to industrial facilities, we have the expertise and equipment to handle any cleaning challenge.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Link href="/services" className="card group cursor-pointer hover:shadow-2xl transition-all duration-300">
                <div className="relative h-72 overflow-hidden rounded-t-2xl">
                  <img
                    src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600"
                    alt="Home Cleaning"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-6 left-6">
                    <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mb-4">
                      <FiHome className="text-dark-900 text-3xl" />
                    </div>
                    <h3 className="text-3xl font-bold text-white">Home Cleaning</h3>
                    <p className="text-white/80 mt-2">{homeCleaning?.services.length || 0} Services Available</p>
                  </div>
                </div>
              </Link>

              <Link href="/services" className="card group cursor-pointer hover:shadow-2xl transition-all duration-300">
                <div className="relative h-72 overflow-hidden rounded-t-2xl">
                  <img
                    src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=600"
                    alt="Industrial Cleaning"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-6 left-6">
                    <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mb-4">
                      <FiBriefcase className="text-dark-900 text-3xl" />
                    </div>
                    <h3 className="text-3xl font-bold text-white">Industrial Cleaning</h3>
                    <p className="text-white/80 mt-2">{industrialCleaning?.services.length || 0} Services Available</p>
                  </div>
                </div>
              </Link>
            </div>

            <Link href="/services" className="block mt-12 bg-gradient-to-r from-primary-500 to-primary-400 rounded-2xl p-8 text-center hover:shadow-2xl transition-all duration-300 group">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <img src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=100" alt="Cleaning" className="w-14 h-14 rounded-full object-cover" />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-bold text-dark-900 mb-2">Explore All Services</h3>
                  <p className="text-dark-900/80">View all service categories and book your cleaning today</p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-primary-600 font-semibold">WHY CHOOSE US</span>
              <h2 className="section-title">The Maintainex Advantage</h2>
              <p className="section-subtitle">
                We go above and beyond to ensure your space is not just clean, but exceptionally maintained.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature) => (
                <div key={feature.title} className="bg-white rounded-2xl p-8 text-center shadow-lg hover:shadow-xl transition-shadow">
                  <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="text-dark-900 text-2xl" />
                  </div>
                  <h3 className="text-xl font-bold text-dark-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 bg-dark-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-primary-500 font-semibold">TESTIMONIALS</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What Our Clients Say</h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Dont just take our word for it. Heres what our satisfied customers have to say.
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
                  <p className="text-gray-300 mb-6 italic">&ldquo;{testimonial.content}&rdquo;</p>
                  <div>
                    <div className="font-bold text-white">{testimonial.name}</div>
                    <div className="text-gray-400 text-sm">{testimonial.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 gradient-bg">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6">
              Ready for a Cleaner Space?
            </h2>
            <p className="text-xl text-dark-900/80 mb-8">
              Book your cleaning service today and experience the Maintainex difference. Shine Beyond Expectations!
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link href="/booking" className="btn-secondary inline-flex items-center justify-center">
                Book Now <FiArrowRight className="ml-2" />
              </Link>
              <a href="tel:0770867609" className="bg-white/20 backdrop-blur-sm text-dark-900 font-semibold px-6 py-3 rounded-lg hover:bg-white/30 transition-all inline-flex items-center justify-center">
                Call 0770867609
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
