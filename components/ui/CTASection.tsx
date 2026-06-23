'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FiArrowRight as FiArrowRightOld } from 'react-icons/fi'
import { useRegion } from '@/lib/region-context'

export default function CTASection() {
  const region = useRegion()

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Link
        href="/booking"
        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-6 py-2.5 rounded-full text-sm transition-all active:scale-95"
      >
        Book Now <ArrowRight className="w-4 h-4" />
      </Link>
      <a
        href={`tel:${region.phoneRaw}`}
        className="inline-flex items-center gap-2 text-background font-medium px-6 py-2.5 rounded-full border border-background/20 hover:border-background/40 text-sm transition-all"
      >
        Call {region.phone}
      </a>
    </div>
  )
}
