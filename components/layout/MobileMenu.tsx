'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowRight, LogIn } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import AppStoreModal from './AppStoreModal'

interface MobileMenuProps {
  navigation: Array<{ name: string; href: string }>
  phoneRaw: string
  phone: string
}

export default function MobileMenu({ navigation, phoneRaw, phone }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="md:hidden p-2.5 text-muted-foreground hover:text-foreground hover:bg-amber-soft/50 rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div className="fixed md:hidden inset-x-0 top-16 z-50 bg-background border-t border-border shadow-lg pb-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="flex flex-col px-4 pt-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className="text-foreground hover:text-amber-600 hover:bg-amber-soft/50 font-medium py-3 px-4 rounded-xl transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
              <Link
                href={`tel:${phoneRaw}`}
                className="text-sm text-muted-foreground hover:text-amber-600 font-medium py-3 px-4"
              >
                {phone}
              </Link>
              <ThemeToggle />
            </div>
            <button
              onClick={() => { setShowSignIn(true); setOpen(false) }}
              className="inline-flex items-center justify-center gap-2 text-foreground font-medium px-5 py-3 rounded-full border border-border hover:border-amber-300 text-sm transition-all mt-2"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </button>
            <Link
              href="/booking"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-5 py-3 rounded-full text-sm transition-all mt-2"
            >
              Book Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      <AppStoreModal open={showSignIn} onClose={() => setShowSignIn(false)} />
    </>
  )
}
