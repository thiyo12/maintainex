'use client'

import { useState, useEffect, useRef } from 'react'

interface FlashOffer {
  id: string
  title: string
  description: string | null
  discountType: string
  discountValue: number
  badgeText: string
  bgColor: string
  textColor: string
  linkUrl: string | null
  maxClaims: number
  currentClaims: number
  expiresAt: string
}

function getRemaining(expiresAt: string): number {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now())
}

function formatCountdown(ms: number): { hh: string; mm: string; ss: string } {
  const total = Math.floor(ms / 1000)
  return {
    hh: String(Math.floor(total / 3600)).padStart(2, '0'),
    mm: String(Math.floor((total % 3600) / 60)).padStart(2, '0'),
    ss: String(total % 60).padStart(2, '0'),
  }
}

export default function FlashOfferSplash() {
  const [offer, setOffer] = useState<FlashOffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [remaining, setRemaining] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'show' | 'launching' | 'done'>('idle')
  const [visible, setVisible] = useState(false)
  const splashRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (sessionStorage.getItem('flash_splash_shown')) {
      setLoading(false)
      return
    }
    fetch('/api/flash-offers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const o = data[0]
          if (o.currentClaims >= o.maxClaims) {
            setLoading(false)
            return
          }
          if (sessionStorage.getItem('flash_splash_shown')) {
            setLoading(false)
            return
          }
          setOffer(o)
          setRemaining(getRemaining(o.expiresAt))
          setPhase('show')
          setVisible(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!offer) return
    intervalRef.current = setInterval(() => {
      setRemaining(getRemaining(offer.expiresAt))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [offer])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const done = sessionStorage.getItem('flash_splash_shown')
    if (done) setLoading(false)
  }, [])

  useEffect(() => {
    if (phase !== 'show') return
    timerRef.current = setTimeout(() => startLaunch(), 3500)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  const startLaunch = () => {
    const splashEl = splashRef.current
    const innerEl = innerRef.current
    if (!splashEl || !innerEl) {
      setPhase('done')
      setVisible(false)
      sessionStorage.setItem('flash_splash_shown', '1')
      return
    }

    setPhase('launching')
    sessionStorage.setItem('flash_splash_shown', '1')

    // Double rAF to ensure CSS transitions fire correctly
    requestAnimationFrame(() => {
      // First frame: set up transitions (values unchanged)
      splashEl.style.transition = 'opacity 0.3s ease-out'
      innerEl.style.transition = 'transform 0.6s cubic-bezier(0.1, 0.9, 0.3, 1), opacity 0.4s ease-out'

      requestAnimationFrame(() => {
        // Second frame: change values — browser sees a diff and fires transitions
        splashEl.style.opacity = '0'
        innerEl.style.transform = 'translateY(-120vh) scale(1.3)'
        innerEl.style.opacity = '0'
      })

      setTimeout(() => {
        setVisible(false)
        setPhase('done')
        splashEl.style.transition = ''
        splashEl.style.opacity = ''
        innerEl.style.transition = ''
        innerEl.style.transform = ''
        innerEl.style.opacity = ''
      }, 650) // slightly after transition completes (600ms + rAF delay)
    })
  }

  if (loading) return null
  if (!visible || !offer || phase === 'done') return null
  if (remaining <= 0) return null

  const { hh, mm, ss } = formatCountdown(remaining)
  const claimPct = Math.min((offer.currentClaims / offer.maxClaims) * 100, 100)
  const isLight = offer.textColor === '#FFFFFF' || offer.textColor === '#ffffff'

  return (
      <div
        ref={splashRef}
        role="dialog"
        aria-modal="true"
        aria-label={offer.title}
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto"
        style={{ backgroundColor: offer.bgColor }}
      >
      <div
        ref={innerRef}
        className="flex flex-col items-center text-center px-4 sm:px-6 max-w-lg mx-auto py-8"
        style={{ color: offer.textColor }}
      >
        <span
          className="text-4xl sm:text-5xl md:text-6xl mb-2 sm:mb-3"
          style={{ animation: 'rkPulse 2s ease-in-out infinite' }}
        >
          {offer.badgeText.split(' ')[0] || '🔥'}
        </span>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{offer.title}</h2>

        {offer.description && (
          <p className={`text-xs sm:text-sm md:text-base mb-3 sm:mb-4 ${isLight ? 'text-white/80' : 'text-black/60'}`}>
            {offer.description}
          </p>
        )}

        <div className="text-3xl sm:text-4xl md:text-6xl font-bold font-mono tracking-wider mb-3 sm:mb-4 flex items-center justify-center">
          <span className="inline-flex items-center">{hh[0]}</span>
          <span className="inline-flex items-center">{hh[1]}</span>
          <span className="inline-flex items-center justify-center w-[0.3em]" style={{ animation: 'rkBlink 1s step-end infinite' }}>:</span>
          <span className="inline-flex items-center">{mm[0]}</span>
          <span className="inline-flex items-center">{mm[1]}</span>
          <span className="inline-flex items-center justify-center w-[0.3em]" style={{ animation: 'rkBlink 1s step-end infinite' }}>:</span>
          <span className="inline-flex items-center">{ss[0]}</span>
          <span className="inline-flex items-center">{ss[1]}</span>
        </div>

        <div className="w-36 sm:w-40 md:w-48 mb-3 sm:mb-4">
          <div className="flex justify-between text-xs mb-1 px-1">
            <span>{offer.currentClaims}/{offer.maxClaims} claimed</span>
            <span>{Math.round(claimPct)}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: offer.textColor + '30' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${claimPct}%`,
                backgroundColor: claimPct >= 100 ? '#EF4444' : '#ffffff',
              }}
            />
          </div>
        </div>

        <a
          href={offer.linkUrl || '/services'}
          className={`inline-block px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all hover:scale-105 ${
            isLight ? 'bg-white text-gray-900' : 'bg-gray-900 text-white'
          }`}
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
        >
          Claim Now
        </a>
      </div>

      <style>{`
        @keyframes rkPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes rkBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
