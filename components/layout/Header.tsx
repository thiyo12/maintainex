'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FiPhone } from 'react-icons/fi'
import { useRegion } from '@/lib/region-context'
import MobileMenu from './MobileMenu'
import ThemeToggle from './ThemeToggle'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '/services' },
  { name: 'About', href: '/about' },
  { name: 'Careers', href: '/careers' },
  { name: 'Contact', href: '/contact' },
]

export default function Header() {
  const region = useRegion()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-dark-800/95 backdrop-blur-md shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo.JPEG" alt="Maintainex" width={40} height={40} className="object-contain" />
            <span className="text-2xl font-bold text-dark-900 dark:text-white">
              Main<span className="text-primary-500">tainex</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-gray-700 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 font-medium transition-colors duration-200 text-sm lg:text-base"
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <a
              href={`tel:${region.phoneRaw}`}
              aria-label={`Call us at ${region.phone}`}
              className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 font-semibold"
            >
              <FiPhone className="animate-pulse" />
              <span className="hidden lg:inline">{region.phone}</span>
            </a>
            <ThemeToggle />
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
