'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRegion } from '@/lib/region-context'
import MobileMenu from './MobileMenu'
import ThemeToggle from './ThemeToggle'

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Services', href: '/services' },
  { name: 'How It Works', href: '/#how-it-works' },
  { name: 'About', href: '/about' },
  { name: 'Vision', href: '/vision' },
]

export default function Header() {
  const region = useRegion()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 h-16 bg-background/70 backdrop-blur-md border-b border-border transition-shadow duration-300 ${scrolled ? 'shadow-lg' : ''}`}>
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.JPEG"
              alt="Maintainex"
              width={32}
              height={32}
              className="size-8 rounded-xl object-cover"
            />
            <span className="text-lg font-black tracking-[-0.02em] text-ink dark:text-white">
              Maintain<span className="text-amber-500">ex</span>
            </span>
            <span className="hidden md:inline text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium leading-tight ml-0.5">
              Find work · Build trust.
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground font-medium rounded-full hover:bg-amber-soft/50 transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/book"
              className="px-4 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-black rounded-full transition-colors"
            >
              Book now
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <div className="flex md:hidden items-center gap-1">
              <ThemeToggle />
              <Link
                href="/book"
                className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-amber-soft/50 transition-colors"
              >
                Sign in
              </Link>
            </div>
            <MobileMenu navigation={navigation} phoneRaw={region.phoneRaw} phone={region.phone} />
          </div>
        </div>
      </nav>

    </header>
  )
}
