'use client'

import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'

export default function CTASection() {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center">
      <Link
        href="/vision"
        className="glow-amber inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold px-8 py-4 rounded-full text-base transition-all active:scale-95"
      >
        Join Waitlist <FiArrowRight className="w-5 h-5" />
      </Link>
      <a
        href="https://wa.me/94770867609"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-white font-medium px-8 py-4 rounded-full border border-white/20 hover:border-white/40 text-base transition-all"
      >
        WhatsApp Us
      </a>
    </div>
  )
}
