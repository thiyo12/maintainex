import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import IndustriesCarousel from '@/components/ui/IndustriesCarousel'

export default function AboutPage() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-400 to-primary-600 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-dark-900 mb-6">
              About Maintain
            </h1>
            <p className="text-xl text-dark-900/80 max-w-3xl mx-auto">
              Shine Beyond Expectations - Your trusted partner for professional cleaning services in Sri Lanka
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6">
                  Our Story
                </h2>
                <p className="text-lg text-gray-600 mb-4">
                  Founded with a mission to revolutionize cleaning services in Sri Lanka, Maintain has grown to become the nation's leading provider of professional cleaning solutions.
                </p>
                <p className="text-lg text-gray-600 mb-4">
                  We believe that everyone deserves a clean, healthy environment. Our team of trained professionals delivers exceptional results with attention to detail and a commitment to customer satisfaction.
                </p>
                <p className="text-lg text-gray-600">
                  From residential homes to commercial spaces, we bring expertise, reliability, and excellence to every project.
                </p>
              </div>
              <div className="bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl p-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4 bg-white rounded-xl shadow-lg">
                    <div className="text-4xl font-bold text-primary-600 mb-2">500+</div>
                    <div className="text-gray-600">Happy Clients</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-xl shadow-lg">
                    <div className="text-4xl font-bold text-primary-600 mb-2">50+</div>
                    <div className="text-gray-600">Professionals</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-xl shadow-lg">
                    <div className="text-4xl font-bold text-primary-600 mb-2">9</div>
                    <div className="text-gray-600">Service Areas</div>
                  </div>
                  <div className="text-center p-4 bg-white rounded-xl shadow-lg">
                    <div className="text-4xl font-bold text-primary-600 mb-2">5★</div>
                    <div className="text-gray-600">Average Rating</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
                Our Mission & Values
              </h2>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                We're committed to delivering excellence in every clean
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-2xl shadow-lg">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl">🎯</span>
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-4">Excellence</h3>
                <p className="text-gray-600">
                  We strive for perfection in every detail, ensuring your space is not just clean, but spotlessly perfect.
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-4">Trust</h3>
                <p className="text-gray-600">
                  All our professionals are vetted, trained, and insured. Your home and business are in safe hands.
                </p>
              </div>
              
              <div className="bg-white p-8 rounded-2xl shadow-lg">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-6">
                  <span className="text-3xl">💯</span>
                </div>
                <h3 className="text-xl font-bold text-dark-900 mb-4">Satisfaction</h3>
                <p className="text-gray-600">
                  Your satisfaction is our priority. We don't rest until you're completely happy with our service.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
                Why Choose Us?
              </h2>
              <p className="text-xl text-gray-600">
                The Maintain difference
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                <span className="text-2xl">✅</span>
                <div>
                  <h4 className="font-semibold text-dark-900 mb-1">Verified Professionals</h4>
                  <p className="text-sm text-gray-600">Background-checked and trained experts</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                <span className="text-2xl">🕐</span>
                <div>
                  <h4 className="font-semibold text-dark-900 mb-1">Flexible Scheduling</h4>
                  <p className="text-sm text-gray-600">Book anytime that suits you</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                <span className="text-2xl">🛡️</span>
                <div>
                  <h4 className="font-semibold text-dark-900 mb-1">Fully Insured</h4>
                  <p className="text-sm text-gray-600">Complete peace of mind</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-xl">
                <span className="text-2xl">💰</span>
                <div>
                  <h4 className="font-semibold text-dark-900 mb-1">Best Prices</h4>
                  <p className="text-sm text-gray-600">Quality service at fair rates</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Industries We Serve - Auto Scroll Rolling */}
        <section className="py-20 bg-gray-50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-4">
                Industries We Serve
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Professional services for every industry
              </p>
            </div>
          </div>
          
          {/* Rolling Carousel */}
          <IndustriesCarousel />

          {/* Partner Section - Below Rolling */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
            <div className="text-center">
              <p className="text-sm text-primary-600 font-medium uppercase mb-2">Our Partner</p>
              <h3 className="text-2xl font-bold text-dark-900 mb-4">MX Cleaning Solution</h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Reliable cleaning partner committed to excellence
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-br from-primary-400 to-primary-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-dark-900 mb-6">
              Ready to Experience the Maintain Difference?
            </h2>
            <p className="text-xl text-dark-900/80 mb-8">
              Book your first cleaning service today and see why we're Sri Lanka's #1 choice.
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
