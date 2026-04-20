'use client'

import { useState, useEffect } from 'react'

const phrases = [
  "NOW IT'S ABOUT VERIFIED PROFESSIONALS.",
  "NO MORE GUESSING. ONLY TRUSTED SERVICE.",
  "SKILLS > CONNECTIONS.",
  "REAL WORK. REAL REVIEWS. REAL TRUST.",
  "BOOK BASED ON QUALITY, NOT CONTACTS.",
  "FROM 'I KNOW A GUY' → TO 'I TRUST THE SYSTEM'",
  "SMART HIRING STARTS HERE.",
  "BUILT FOR RELIABILITY.",
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
        <span className="text-dark-900">The </span>
        <span className="relative inline-block min-h-[1.2em] overflow-hidden">
          <span 
            className={`transition-all duration-500 ease-in-out ${
              isVisible 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-full'
            } ${isAnimating ? 'duration-500' : ''}`}
            style={{
              color: '#ffffff',
              textShadow: `
                0 0 10px rgba(255, 255, 255, 0.8),
                0 0 20px rgba(255, 255, 255, 0.6),
                0 0 30px rgba(255, 255, 255, 0.4),
                0 0 40px rgba(255, 255, 255, 0.2)
              `
            }}
          >
            {phrases[currentPhraseIndex]}
          </span>
        </span>
        <span className="text-dark-900"> Era is officially over.</span>
      </h1>
      
      {/* Decorative line under the animated text */}
      <div className="flex items-center gap-4 mt-6">
        <div className="w-16 md:w-24 h-0.5 bg-gradient-to-r from-dark-900/50 to-transparent" />
        <span 
          className="text-dark-900 font-semibold tracking-widest uppercase text-sm md:text-base"
        >
          Maintainex
        </span>
      </div>
    </div>
  )
}
