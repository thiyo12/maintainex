'use client'

import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'
import { useRegion } from '@/lib/region-context'

export default function CTASection() {
  const region = useRegion()

  return (
    <div className="flex flex-col md:flex-row gap-4 justify-center">
      <Link href="/booking" className="btn-secondary inline-flex items-center justify-center">
        Book Now <FiArrowRight className="ml-2" />
      </Link>
      <a href={`tel:${region.phoneRaw}`} className="bg-white/20 backdrop-blur-sm text-dark-900 font-semibold px-6 py-3 rounded-lg hover:bg-white/30 transition-all inline-flex items-center justify-center">
        Call {region.phone}
      </a>
    </div>
  )
}
