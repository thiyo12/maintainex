import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import Image from 'next/image'
import { FiTarget, FiEye, FiHeart, FiUsers, FiAward, FiClock, FiThumbsUp } from 'react-icons/fi'

export default function AboutPage() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="py-24 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-dark-900 mb-6">About Maintainex</h1>
            <p className="text-xl text-dark-900/80 max-w-3xl mx-auto">
              Shine Beyond Expectations. Your trusted partner for professional cleaning services across Sri Lanka.
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <span className="text-primary-600 font-semibold">OUR STORY</span>
                <h2 className="section-title mt-2">Building Trust Through Excellence</h2>
                <p className="text-gray-600 mb-6">
                  Founded in 2020, Maintainex began with a simple vision: to provide reliable, professional cleaning services that make a real difference in people&apos;s lives. What started as a small team of dedicated individuals has grown into Sri Lanka&apos;s most trusted cleaning service.
                </p>
                <p className="text-gray-600 mb-6">
                  Our journey has been driven by our commitment to excellence and our belief that everyone deserves to live and work in a clean, healthy environment. We take pride in our attention to detail and our ability to tailor our services to meet each client&apos;s unique needs.
                </p>
                <p className="text-gray-600">
                  Today, we serve hundreds of homes and businesses across Sri Lanka, from small apartments to large industrial facilities. Our team of trained professionals is equipped with the latest cleaning technology and eco-friendly products to deliver outstanding results every time.
                </p>
              </div>
              <div className="relative">
                <Image
                  src="https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800"
                  alt="Our team"
                  width={800}
                  height={600}
                  className="rounded-2xl shadow-2xl"
                  style={{ objectFit: 'cover' }}
                />
                <div className="absolute -bottom-8 -left-8 bg-primary-500 text-dark-900 p-8 rounded-2xl shadow-xl">
                  <div className="text-4xl font-bold">5+</div>
                  <div className="font-semibold">Years of Excellence</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiUsers className="text-dark-900 text-2xl" />
                </div>
                <div className="text-3xl font-bold text-dark-900">500+</div>
                <div className="text-gray-600">Happy Clients</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiThumbsUp className="text-dark-900 text-2xl" />
                </div>
                <div className="text-3xl font-bold text-dark-900">1000+</div>
                <div className="text-gray-600">Transactions</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiAward className="text-dark-900 text-2xl" />
                </div>
                <div className="text-3xl font-bold text-dark-900">4.9</div>
                <div className="text-gray-600">Star Rating</div>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiUsers className="text-dark-900 text-2xl" />
                </div>
                <div className="text-3xl font-bold text-dark-900">50+</div>
                <div className="text-gray-600">Team Members</div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Vision Values */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-primary-600 font-semibold">WHO WE ARE</span>
              <h2 className="section-title mt-2">Our Foundation</h2>
              <p className="text-gray-600 mt-4">Shine Beyond Expectations</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="card p-8">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mb-6">
                  <FiTarget className="text-dark-900 text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-4">Our Mission</h3>
                <p className="text-gray-600">To provide exceptional cleaning services that enhance the quality of life for our clients while creating sustainable employment opportunities in our community.</p>
              </div>
              <div className="card p-8">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mb-6">
                  <FiEye className="text-dark-900 text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-4">Our Vision</h3>
                <p className="text-gray-600">To be the leading cleaning service provider in Northern Sri Lanka, recognized for our commitment to excellence, innovation, and environmental responsibility.</p>
              </div>
              <div className="card p-8">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mb-6">
                  <FiHeart className="text-dark-900 text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-4">Our Values</h3>
                <p className="text-gray-600">Shine Beyond Expectations. Integrity, professionalism, reliability, and customer satisfaction form the foundation of everything we do.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="text-primary-600 font-semibold">WHY CHOOSE US</span>
              <h2 className="section-title mt-2">The Maintainex Difference</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiAward className="text-dark-900 text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-dark-900 mb-2">Professional Team</h3>
                <p className="text-gray-600 text-sm">Trained and vetted cleaning professionals</p>
              </div>
              <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiClock className="text-dark-900 text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-dark-900 mb-2">Flexible Scheduling</h3>
                <p className="text-gray-600 text-sm">Book at your convenience</p>
              </div>
              <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiThumbsUp className="text-dark-900 text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-dark-900 mb-2">Quality Guaranteed</h3>
                <p className="text-gray-600 text-sm">100% satisfaction guaranteed</p>
              </div>
              <div className="bg-white rounded-2xl p-6 text-center shadow-lg">
                <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FiUsers className="text-dark-900 text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-dark-900 mb-2">1000+ Clients</h3>
                <p className="text-gray-600 text-sm">Trusted by hundreds of happy clients</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
