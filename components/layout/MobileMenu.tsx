'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiMenu, FiX, FiPhone } from 'react-icons/fi'

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
        className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        {open ? <FiX size={28} /> : <FiMenu size={28} />}
      </button>

      {open && (
        <div className="md:hidden border-t border-gray-100 py-4">
          <div className="flex flex-col space-y-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-gray-700 hover:text-primary-500 hover:bg-gray-50 font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <div className="pt-4 border-t border-gray-100 mt-4">
              <a
                href={`tel:${phoneRaw}`}
                className="flex items-center space-x-2 text-primary-600 font-semibold py-3 px-4"
              >
                <FiPhone className="animate-pulse" />
                <span>{phone}</span>
              </a>
              <Link
                href="/booking"
                onClick={() => setOpen(false)}
                className="btn-primary w-full text-center"
              >
                Book Now
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
