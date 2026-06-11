import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import Link from 'next/link'
import Image from 'next/image'
import { FiMail, FiPhone, FiMapPin } from 'react-icons/fi'
import { FaFacebookF, FaTwitter, FaInstagram, FaTiktok, FaLinkedinIn, FaWhatsapp } from 'react-icons/fa'
import AppStoreModal from './AppStoreModal'

export default function Footer() {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const region = REGIONS[regionKey]

  return (
    <footer className="bg-dark-900 text-white">
      <AppStoreModal />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <Image src="/logo.JPEG" alt="Maintainex" width={40} height={40} className="object-contain" />
              <span className="text-2xl font-bold">
                Main<span className="text-primary-500">tainex</span>
              </span>
            </div>
            <p className="text-gray-300 mb-6">
              Shine Beyond Expectations. Professional cleaning services for homes and businesses across {region.countryName}.
            </p>
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-4">Follow Us</h4>
              <div className="flex space-x-3">
                <a href="https://facebook.com/maintainex.lk" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <FaFacebookF className="text-lg" />
                </a>
                <a href="https://twitter.com/maintainex.lk" target="_blank" rel="noopener noreferrer" aria-label="Twitter" className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-sky-500 transition-colors">
                  <FaTwitter className="text-lg" />
                </a>
                <a href="https://instagram.com/maintainex.lk" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-pink-600 transition-colors">
                  <FaInstagram className="text-lg" />
                </a>
                <a href="https://tiktok.com/@maintainex.lk" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-white hover:text-black transition-colors">
                  <FaTiktok className="text-lg" />
                </a>
                <a href="https://linkedin.com/company/maintainex.lk" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors">
                  <FaLinkedinIn className="text-lg" />
                </a>
              </div>
            </div>

            <div className="mt-8">
              <h4 className="text-lg font-semibold mb-4">Download Our App</h4>
              <div className="flex flex-col sm:flex-row gap-4">
                <AppStoreModal />
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link href="/" className="text-gray-300 hover:text-primary-500 transition-colors">Home</Link></li>
              <li><Link href="/services" className="text-gray-300 hover:text-primary-500 transition-colors">Services</Link></li>
              <li><Link href="/about" className="text-gray-300 hover:text-primary-500 transition-colors">About Us</Link></li>
              <li><Link href="/careers" className="text-gray-300 hover:text-primary-500 transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="text-gray-300 hover:text-primary-500 transition-colors">Contact</Link></li>
              <li><Link href="/booking" className="text-gray-300 hover:text-primary-500 transition-colors">Booking</Link></li>
            </ul>
          </div>

          {/* Services Section */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Services</h3>
            <ul className="space-y-3">
              <li><Link href="/services#home-cleaning" className="text-gray-300 hover:text-primary-500 transition-colors">Home Cleaning</Link></li>
              <li><Link href="/services#office-cleaning" className="text-gray-300 hover:text-primary-500 transition-colors">Office Cleaning</Link></li>
              <li><Link href="/services#deep-cleaning" className="text-gray-300 hover:text-primary-500 transition-colors">Deep Cleaning</Link></li>
              <li><Link href="/services#post-construction" className="text-gray-300 hover:text-primary-500 transition-colors">Post Construction</Link></li>
              <li><Link href="/services#pest-control" className="text-gray-300 hover:text-primary-500 transition-colors">Pest Control</Link></li>
              <li><Link href="/services#landscape" className="text-gray-300 hover:text-primary-500 transition-colors">Landscaping</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Contact Info</h3>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <FiMapPin className="text-primary-500 mt-1 flex-shrink-0" />
                <span className="text-gray-300">{region.label === 'Canada' ? 'Toronto, Ontario, Canada' : '57/1 New Senguntha Road, Thirunelvaly, Sri Lanka'}</span>
              </li>
              <li className="flex items-center space-x-3">
                <FiPhone className="text-primary-500 flex-shrink-0" />
                <a href={`tel:${region.phoneRaw}`} className="text-gray-300 hover:text-primary-500 transition-colors">{region.phone}</a>
              </li>
              <li className="flex items-center space-x-3">
                <FiMail className="text-primary-500 flex-shrink-0" />
                <a href={`mailto:${region.email}`} className="text-gray-300 hover:text-primary-500 transition-colors">{region.email}</a>
              </li>
              <li className="flex items-center space-x-3">
                <FaWhatsapp className="text-primary-500 flex-shrink-0" />
                <a href={`https://wa.me/${region.whatsapp}`} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-primary-500 transition-colors">WhatsApp Us</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} Maintainex. All rights reserved. | Shine Beyond Expectations | Made with care{region.label === 'Canada' ? ' in Canada' : ' in Sri Lanka'}</p>
        </div>
      </div>
    </footer>
  )
}
