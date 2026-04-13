'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FiMail, FiPhone, FiMapPin, FiX, FiSmartphone } from 'react-icons/fi'
import { FaFacebookF, FaTwitter, FaInstagram, FaTiktok, FaLinkedinIn } from 'react-icons/fa'

export default function Footer() {
  const [showAppMessage, setShowAppMessage] = useState(false)

  const handleAppClick = () => {
    setShowAppMessage(true)
  }

  return (
    <footer className="bg-dark-900 text-white">
      {showAppMessage && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
            <button
              onClick={() => setShowAppMessage(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <FiX size={24} />
            </button>
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiSmartphone className="text-primary-600 text-4xl" />
            </div>
            <h3 className="text-2xl font-bold text-dark-900 mb-4">App Coming Soon!</h3>
            <p className="text-gray-600 mb-6">
              We&apos;re working hard to bring Maintainex to you. Stay tuned for our official launch!
            </p>
            <button
              onClick={() => setShowAppMessage(false)}
              className="btn-primary"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <div className="flex items-center space-x-2 mb-6">
              <Image src="/logo.JPEG" alt="Maintain" width={40} height={40} className="object-contain" />
              <span className="text-2xl font-bold">
                Main<span className="text-primary-500">tain</span>
              </span>
            </div>
            <p className="text-gray-400 mb-6">
              Shine Beyond Expectations. Professional cleaning services for homes and businesses across Sri Lanka.
            </p>
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-4">Follow Us</h4>
              <div className="flex space-x-3">
                <a href="https://facebook.com/maintainex.lk" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <FaFacebookF className="text-lg" />
                </a>
                <a href="https://twitter.com/maintainex.lk" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-sky-500 transition-colors">
                  <FaTwitter className="text-lg" />
                </a>
                <a href="https://instagram.com/maintainex.lk" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors">
                  <FaInstagram className="text-lg" />
                </a>
                <a href="https://tiktok.com/@maintainex.lk" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-colors">
                  <FaTiktok className="text-lg" />
                </a>
                <a href="https://linkedin.com/company/maintainex.lk" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                  <FaLinkedinIn className="text-lg" />
                </a>
              </div>
            </div>
            
            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-4">Download Our App</h4>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleAppClick}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-3 transition-colors"
                >
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-gray-400">Download on</div>
                    <div className="font-semibold">Google Play</div>
                  </div>
                </button>
                <button
                  onClick={handleAppClick}
                  className="flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-3 transition-colors"
                >
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-gray-400">Download on the</div>
                    <div className="font-semibold">App Store</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-gray-400 hover:text-primary-500 transition-colors">Home</Link></li>
              <li><Link href="/about" className="text-gray-400 hover:text-primary-500 transition-colors">About Us</Link></li>
              <li><Link href="/booking" className="text-gray-400 hover:text-primary-500 transition-colors">Book Now</Link></li>
              <li><Link href="/careers" className="text-gray-400 hover:text-primary-500 transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-primary-500 transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-6">Contact Info</h3>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <FiMapPin className="text-primary-500 mt-1 flex-shrink-0" />
                <span className="text-gray-400">57/1 New Senguntha Road, Thirunelvaly, Sri Lanka</span>
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
