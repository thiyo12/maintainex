'use client'

import { useState, useEffect } from 'react'

const phrases = [
  "PROFESSIONAL CLEANING SERVICES",
  "TRUSTED BY THOUSANDS",
  "BOOK IN SECONDS",
  "QUALITY GUARANTEED",
  "24/7 SUPPORT AVAILABLE",
  "SERVING ALL OF SRI LANKA",
  "SATISFACTION ASSURED",
  "EXPERTS YOU CAN TRUST",
]

export default function AnimatedHero() {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)
      setIsVisible(false)
      
      setTimeout(() => {
        setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length)
        setIsVisible(true)
        setTimeout(() => {
          setIsAnimating(false)
        }, 300)
      }, 500)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="text-left">
      <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-4">
        <span className="relative inline-block min-h-[1.2em] overflow-hidden">
          <span 
            className={`transition-all duration-500 ease-in-out text-white ${
              isVisible 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-full'
            } ${isAnimating ? 'duration-500' : ''}`}
          >
            {phrases[currentPhraseIndex]}
          </span>
        </span>
      </h1>
      <p className="text-lg md:text-xl text-white/90 mt-2">Easy way to care for your space</p>
      
      {/* Decorative line under the animated text */}
      <div className="flex items-center gap-4 mt-6">
        <div className="w-16 md:w-24 h-0.5 bg-gradient-to-r from-white/50 to-transparent" />
        <span 
          className="text-white font-semibold tracking-widest uppercase text-sm md:text-base"
        >
          Maintainex
        </span>
      </div>
    </div>
  )
}
