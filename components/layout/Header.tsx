import { headers } from 'next/headers'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import Link from 'next/link'
import Image from 'next/image'
import { FiPhone } from 'react-icons/fi'
import MobileMenu from './MobileMenu'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '/services' },
  { name: 'About', href: '/about' },
  { name: 'Careers', href: '/careers' },
  { name: 'Contact', href: '/contact' },
]

export default function Header() {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const region = REGIONS[regionKey]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo.JPEG" alt="Maintainex" width={40} height={40} className="object-contain" />
            <span className="text-2xl font-bold text-dark-900">
              Main<span className="text-primary-500">tainex</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-gray-700 hover:text-primary-500 font-medium transition-colors duration-200 text-sm lg:text-base"
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <a
              href={`tel:${region.phoneRaw}`}
              aria-label={`Call us at ${region.phone}`}
              className="flex items-center space-x-2 text-primary-600 font-semibold"
            >
              <FiPhone className="animate-pulse" />
              <span className="hidden lg:inline">{region.phone}</span>
            </a>
            <Link href="/booking" className="btn-primary">
              Book Now
            </Link>
          </div>

          <MobileMenu navigation={navigation} phoneRaw={region.phoneRaw} phone={region.phone} />
        </div>
      </nav>
    </header>
  )
}
