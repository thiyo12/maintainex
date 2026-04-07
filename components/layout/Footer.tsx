import Link from 'next/link'
import { FiMail, FiPhone, FiMapPin } from 'react-icons/fi'

export default function Footer() {
  return (
    <footer className="bg-dark-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
                <span className="text-dark-900 font-bold text-xl">M</span>
              </div>
              <span className="text-2xl font-bold">
                Main<span className="text-primary-500">tainex</span>
              </span>
            </div>
            <p className="text-gray-400 mb-6">
              Shine Beyond Expectations. Professional cleaning services for homes and businesses in Jaffna.
            </p>
            <div className="flex space-x-4">
              <a href="https://facebook.com/maintainex.lk" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-primary-500 transition-colors">
                <span className="text-sm">f</span>
              </a>
              <a href="https://instagram.com/maintainex.lk" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-primary-500 transition-colors">
                <span className="text-sm">ig</span>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-gray-400 hover:text-primary-500 transition-colors">Home</Link></li>
              <li><Link href="/about" className="text-gray-400 hover:text-primary-500 transition-colors">About Us</Link></li>
              <li><Link href="/services" className="text-gray-400 hover:text-primary-500 transition-colors">Services</Link></li>
              <li><Link href="/booking" className="text-gray-400 hover:text-primary-500 transition-colors">Book Now</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-primary-500 transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Services</h3>
            <ul className="space-y-3">
              <li><Link href="/services" className="text-gray-400 hover:text-primary-500 transition-colors">Home Cleaning</Link></li>
              <li><Link href="/services" className="text-gray-400 hover:text-primary-500 transition-colors">Office Cleaning</Link></li>
              <li><Link href="/services" className="text-gray-400 hover:text-primary-500 transition-colors">Deep Cleaning</Link></li>
              <li><Link href="/services" className="text-gray-400 hover:text-primary-500 transition-colors">Industrial Cleaning</Link></li>
              <li><Link href="/services" className="text-gray-400 hover:text-primary-500 transition-colors">Carpet Cleaning</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Contact Info</h3>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <FiMapPin className="text-primary-500 mt-1 flex-shrink-0" />
                <span className="text-gray-400">57/1 New Senguntha Road, Thirunelvaly, Jaffna, Sri Lanka</span>
              </li>
              <li className="flex items-center space-x-3">
                <FiPhone className="text-primary-500 flex-shrink-0" />
                <a href="tel:0770867609" className="text-gray-400 hover:text-primary-500 transition-colors">0770867609</a>
              </li>
              <li className="flex items-center space-x-3">
                <FiMail className="text-primary-500 flex-shrink-0" />
                <a href="mailto:maintainex.lk@gmail.com" className="text-gray-400 hover:text-primary-500 transition-colors">maintainex.lk@gmail.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} Maintainex. All rights reserved. | Shine Beyond Expectations</p>
        </div>
      </div>
    </footer>
  )
}
