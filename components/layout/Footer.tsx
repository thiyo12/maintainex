'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRegion } from '@/lib/region-context'

const SOCIALS = [
  { name: 'Facebook', file: 'icons8-facebook-50.png', url: 'https://facebook.com/maintainex.lk' },
  { name: 'Instagram', file: 'icons8-instagram-50.png', url: 'https://instagram.com/maintainex.lk' },
  { name: 'LinkedIn', file: 'icons8-linkedin-circled-100.png', url: 'https://linkedin.com/company/maintainex-lk' },
  { name: 'X', file: 'icons8-x-100.png', url: 'https://x.com/maintainexlk' },
  { name: 'TikTok', file: 'icons8-tiktok-50.png', url: 'https://tiktok.com/@maintainex.lk' },
  { name: 'WhatsApp', file: 'icons8-whatsapp-100.png', url: 'https://wa.me/94770867609' },
]

export default function Footer() {
  const region = useRegion()

  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <Image
                src="/logo.JPEG"
                alt="Maintainex"
                width={32}
                height={32}
                className="size-8 rounded-xl object-cover"
              />
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
              <li><Link href="/services" className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">Services</Link></li>
              <li><Link href="/booking" className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">Booking</Link></li>
              <li><Link href="/vision" className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">Vision</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-4">Company</h4>
            <ul className="space-y-2">
              <li><Link href="/about" className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">About</Link></li>
              <li><Link href="/contact" className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">Contact</Link></li>
              <li><a href={`tel:${region.phoneRaw}`} className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">{region.phone}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-4">Connect</h4>
            <div className="flex flex-wrap gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.name}
                  className="size-11 rounded-xl bg-card border border-border flex items-center justify-center hover:border-amber-300 hover:bg-amber-soft/50 transition-all"
                >
                  <Image
                    src={`/uploads/icons/${s.file}`}
                    alt={s.name}
                    width={26}
                    height={26}
                    className="size-[26px]"
                  />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-muted-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="block py-2 text-sm text-foreground hover:text-amber-600 transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Maintainex — Made in Sri Lanka with care
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Design & Developed by{' '}
            <a
              href="https://instagram.com/thiyothman"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:text-amber-500 font-semibold transition-colors"
            >
              Thiyothman
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
