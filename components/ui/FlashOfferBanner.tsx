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

function FlipDigit({ digit, prevDigit }: { digit: string; prevDigit: string }) {
  const [phase, setPhase] = useState<'show' | 'exit' | 'enter'>('show')
  const [displayed, setDisplayed] = useState(digit)

  useEffect(() => {
    if (digit !== displayed) {
      setPhase('exit')
      const t1 = setTimeout(() => {
        setDisplayed(digit)
        setPhase('enter')
      }, 150)
      const t2 = setTimeout(() => {
        setPhase('show')
      }, 300)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [digit])

  return (
    <span className="relative inline-flex items-center justify-center w-[0.55em] h-[1em] align-middle font-bold font-mono">
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: phase === 'exit' ? 'scaleY(0)' : 'scaleY(1)',
          transition: 'transform 0.15s ease-in',
          transformOrigin: 'bottom center',
        }}
      >
        {displayed}
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: phase === 'enter' ? 'scaleY(1)' : 'scaleY(0)',
          transition: 'transform 0.15s ease-out 0.15s',
          transformOrigin: 'top center',
        }}
      >
        {digit}
      </span>
    </span>
  )
}

function Colon() {
  return (
    <span
      className="inline-flex items-center justify-center w-[0.25em] align-middle font-bold font-mono"
      style={{ animation: 'foBlink 1s step-end infinite' }}
    >
      :
    </span>
  )
}

export default function FlashOfferBanner() {
  const [offer, setOffer] = useState<FlashOffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [remaining, setRemaining] = useState(0)
  const [visible, setVisible] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const prevRef = useRef({ hh: '00', mm: '00', ss: '00' })
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    fetch('/api/flash-offers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setOffer(data[0])
          setRemaining(getRemaining(data[0].expiresAt))
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
    if (loading) return
    if (sessionStorage.getItem('flash_splash_shown')) {
      setVisible(true)
      return
    }
    let cancelled = false
    const poll = setInterval(() => {
      if (sessionStorage.getItem('flash_splash_shown') && !cancelled) {
        setVisible(true)
        clearInterval(poll)
      }
    }, 100)
    // Fallback: show banner even if no splash after 2.5s
    const fallback = setTimeout(() => {
      if (!cancelled) {
        setVisible(true)
        clearInterval(poll)
      }
    }, 2500)
    return () => { cancelled = true; clearInterval(poll); clearTimeout(fallback) }
  }, [loading])

  const handleClaim = async () => {
    if (!offer || claiming || offer.currentClaims >= offer.maxClaims) return
    setClaiming(true)
    try {
      await fetch('/api/flash-offers/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: offer.id }),
      })
      const res = await fetch('/api/flash-offers')
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) setOffer(data[0])
    } catch {}
    setClaiming(false)
  }

  if (loading || !offer || remaining <= 0) return null

  const { hh, mm, ss } = formatCountdown(remaining)
  const claimPct = Math.min((offer.currentClaims / offer.maxClaims) * 100, 100)
  const prev = prevRef.current
  prevRef.current = { hh, mm, ss }
  const fullyClaimed = offer.currentClaims >= offer.maxClaims

  return (
    <div
      id="flash-offer-target"
      className={`text-center sm:text-left transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <div
        className="flex items-center gap-1.5 justify-center sm:justify-start text-3xl md:text-4xl"
        style={{ color: offer.textColor }}
      >
        <span
          className="text-lg md:text-xl font-sans leading-none"
          style={{ animation: 'foPulse 2s ease-in-out infinite' }}
        >
          {offer.badgeText.split(' ')[0] || '🔥'}
        </span>
        <FlipDigit digit={hh[0]} prevDigit={prev.hh[0]} />
        <FlipDigit digit={hh[1]} prevDigit={prev.hh[1]} />
        <Colon />
        <FlipDigit digit={mm[0]} prevDigit={prev.mm[0]} />
        <FlipDigit digit={mm[1]} prevDigit={prev.mm[1]} />
        <Colon />
        <FlipDigit digit={ss[0]} prevDigit={prev.ss[0]} />
        <FlipDigit digit={ss[1]} prevDigit={prev.ss[1]} />
      </div>
      <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
        <div className="w-14 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: offer.bgColor + '40' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${claimPct}%`,
              backgroundColor: fullyClaimed ? '#EF4444' : '#48BB78',
            }}
          />
        </div>
        <span className="text-dark-900/70 text-xs whitespace-nowrap font-medium">
          {fullyClaimed ? 'Fully Claimed' : `${offer.currentClaims}/${offer.maxClaims}`}
        </span>
      </div>
      <button
        onClick={handleClaim}
        disabled={fullyClaimed || claiming}
        className={`text-xs md:text-sm mt-0.5 font-medium transition-colors ${
          fullyClaimed
            ? 'text-gray-400 cursor-not-allowed'
            : offer.textColor === '#FFFFFF' || offer.textColor === '#ffffff'
              ? 'text-white/70 hover:text-white'
              : 'text-dark-900/70 hover:text-dark-900'
        }`}
      >
        {fullyClaimed ? 'All claimed' : claiming ? 'Claiming...' : `${offer.badgeText} Offer`}
      </button>

      <style>{`
        @keyframes foPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes foBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
