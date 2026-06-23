'use client'

import { Sparkles } from 'lucide-react'

export default function AnimatedHero() {
  return (
    <div className="animate-fade-up">
      <div className="inline-flex items-center gap-1.5 bg-amber-soft rounded-full px-3 py-1.5 mb-6">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        <span className="text-xs font-semibold text-amber-800">
          Now with AI job matching — type it like you say it
        </span>
      </div>

      <h1 className="text-[clamp(40px,8vw,96px)] font-black tracking-[-0.03em] leading-[0.92] text-ink">
        Hire someone who{' '}
        <span className="relative inline-block">
          actually
          <svg
            viewBox="0 0 200 20"
            className="absolute -bottom-2 left-0 w-full h-3 fill-amber-500/60"
            preserveAspectRatio="none"
          >
            <path
              d="M0 12 Q 25 0, 50 10 T 100 8 T 150 12 T 200 10"
              stroke="none"
              fill="inherit"
            />
          </svg>
        </span>{' '}
        <em className="font-serif italic text-[1.05em] text-amber-600 not-italic" style={{ fontFamily: 'Georgia, serif' }}>
          shows up.
        </em>
      </h1>
    </div>
  )
}
