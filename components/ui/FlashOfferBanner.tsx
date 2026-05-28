'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface FlashOffer {
  id: string
  title: string
  description: string | null
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
      style={{ animation: 'foColonBlink 1s step-end infinite' }}
    >
      :
    </span>
  )
}

export default function FlashOfferBanner() {
  const [offer, setOffer] = useState<FlashOffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [remaining, setRemaining] = useState(0)
  const prevRef = useRef({ hh: '00', mm: '00', ss: '00' })
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    fetch('/api/flash-offers')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const active = data[0]
          setOffer(active)
          setRemaining(getRemaining(active.expiresAt))
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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [offer])

  if (loading || !offer || remaining <= 0) return null

  const { hh, mm, ss } = formatCountdown(remaining)
  const claimPct = Math.min((offer.currentClaims / offer.maxClaims) * 100, 100)
  const prev = prevRef.current
  prevRef.current = { hh, mm, ss }

  return (
    <div className="text-center sm:text-left">
      <div className="flex items-center gap-1.5 justify-center sm:justify-start text-3xl md:text-4xl text-dark-900">
        <span
          className="text-lg md:text-xl"
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
        <div className="w-14 h-1.5 bg-dark-900/10 rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${claimPct}%`,
              backgroundColor: claimPct >= 100 ? '#EF4444' : '#48BB78',
            }}
          />
        </div>
        <span className="text-dark-900/70 text-xs whitespace-nowrap font-medium">
          {offer.currentClaims}/{offer.maxClaims}
        </span>
      </div>
      <div className="text-dark-900/70 text-xs md:text-sm mt-0.5">
        {offer.linkUrl ? (
          <Link href={offer.linkUrl} className="hover:underline font-medium">
            {offer.badgeText} Offer
          </Link>
        ) : (
          <span>{offer.badgeText} Offer</span>
        )}
      </div>

      <style>{`
        @keyframes foPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes foColonBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  )
}
