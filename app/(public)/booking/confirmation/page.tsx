import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import Link from 'next/link'
import { FiCheckCircle, FiArrowRight, FiHome } from 'react-icons/fi'

export default function BookingConfirmation() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20 min-h-screen gradient-bg flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="bg-white rounded-3xl shadow-2xl p-12">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <FiCheckCircle className="text-green-500 text-5xl" />
            </div>
            
            <h1 className="text-3xl font-bold text-dark-900 mb-4">Booking Confirmed!</h1>
            <p className="text-gray-600 mb-8">
              Thank you for choosing Maintainex. We have received your booking request and will contact you shortly to confirm the details.
            </p>

            <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left">
              <h3 className="font-semibold text-dark-900 mb-4">What happens next?</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-dark-900 text-sm font-bold mr-3 flex-shrink-0">1</span>
                  <span className="text-gray-600">Our team will review your booking within 24 hours</span>
                </li>
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-dark-900 text-sm font-bold mr-3 flex-shrink-0">2</span>
                  <span className="text-gray-600">We will call or message to confirm the schedule</span>
                </li>
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center text-dark-900 text-sm font-bold mr-3 flex-shrink-0">3</span>
                  <span className="text-gray-600">Our professional team will arrive at the scheduled time</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/" className="flex-1 btn-secondary inline-flex items-center justify-center">
                <FiHome className="mr-2" />
                Back to Home
              </Link>
              <Link href="/contact" className="flex-1 btn-outline inline-flex items-center justify-center">
                Contact Us <FiArrowRight className="ml-2" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
