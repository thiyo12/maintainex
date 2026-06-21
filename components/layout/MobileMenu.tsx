'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiMenu, FiX, FiPhone } from 'react-icons/fi'
import ThemeToggle from './ThemeToggle'

interface MobileMenuProps {
  navigation: Array<{ name: string; href: string }>
  phoneRaw: string
  phone: string
}

export default function MobileMenu({ navigation, phoneRaw, phone }: MobileMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-300 rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        {open ? <FiX size={28} /> : <FiMenu size={28} />}
      </button>

      {open && (
        <div className="fixed md:hidden inset-x-0 top-20 z-50 bg-white dark:bg-dark-800 border-t border-gray-100 dark:border-dark-300 shadow-lg pb-6 overflow-y-auto max-h-[calc(100vh-5rem)]">
          <div className="flex flex-col space-y-2 px-4 pt-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-gray-700 dark:text-gray-200 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-dark-300 font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-dark-300 mt-4">
              <a
                href={`tel:${phoneRaw}`}
                className="flex items-center space-x-2 text-primary-600 dark:text-primary-400 font-semibold py-3 px-4"
              >
                <FiPhone className="animate-pulse" />
                <span>{phone}</span>
              </a>
              <ThemeToggle />
            </div>
            <Link
              href="/booking"
              onClick={() => setOpen(false)}
              className="btn-primary w-full text-center mt-2"
            >
              Book Now
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
