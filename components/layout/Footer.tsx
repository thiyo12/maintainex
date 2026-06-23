'use client'

import Link from 'next/link'
import { Briefcase } from 'lucide-react'
import { useRegion } from '@/lib/region-context'

export default function Footer() {
  const region = useRegion()

  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="size-8 rounded-2xl bg-amber-500 flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-ink" />
              </div>
              <span className="text-base font-black tracking-[-0.02em] text-ink dark:text-white">
                Maintain<span className="text-amber-500">ex</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              One Partner for All Your Property Maintenance Needs. Professional services for homes and businesses across {region.countryName}.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/services" className="text-sm text-foreground hover:text-amber-600 transition-colors">Services</Link></li>
              <li><Link href="/booking" className="text-sm text-foreground hover:text-amber-600 transition-colors">Booking</Link></li>
              <li><Link href="/about" className="text-sm text-foreground hover:text-amber-600 transition-colors">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-4">Company</h4>
            <ul className="space-y-2">
              <li><Link href="/careers" className="text-sm text-foreground hover:text-amber-600 transition-colors">Careers</Link></li>
              <li><Link href="/contact" className="text-sm text-foreground hover:text-amber-600 transition-colors">Contact</Link></li>
              <li><a href={`tel:${region.phoneRaw}`} className="text-sm text-foreground hover:text-amber-600 transition-colors">{region.phone}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="text-sm text-foreground hover:text-amber-600 transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="text-sm text-foreground hover:text-amber-600 transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Maintainex — Made in Colombo with care
          </p>
        </div>
      </div>
    </footer>
  )
}
