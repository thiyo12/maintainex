'use client'

import { useState, useEffect } from 'react'

const WELCOME_KEY = 'maintain_welcome_shown'

export default function WelcomeBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [showStep, setShowStep] = useState(1)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const hasSeen = localStorage.getItem(WELCOME_KEY)
    if (hasSeen) {
      setIsVisible(false)
      return
    }

    setIsVisible(true)
    
    const timers = [
      setTimeout(() => setShowStep(2), 150),
      setTimeout(() => setShowStep(3), 400),
      setTimeout(() => setIsExiting(true), 1800),
      setTimeout(() => {
        setIsVisible(false)
        localStorage.setItem(WELCOME_KEY, 'true')
      }, 2500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  if (!isVisible) return null

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-1000 ${
        isExiting ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      style={{ background: 'linear-gradient(135deg, #FFC300, #FFD54F, #FFE082, #FFD54F, #FFC300)' }}
    >
      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Loading dots */}
      <div className="absolute top-8 right-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-dark-900/40"
            style={{
              animation: 'bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="text-center px-4">
        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-dark-900">
          #1 Service Experts
        </h2>
        
        <p className="text-3xl md:text-5xl lg:text-6xl font-bold text-dark-900 mt-2">
          in Sri Lanka
        </p>

        {showStep >= 2 && (
          <div className="flex items-center justify-center gap-4 mt-6 transition-all duration-500">
            <div className="h-0.5 w-12 md:w-20 bg-dark-900/50" />
            <p className="text-xl md:text-2xl lg:text-3xl font-bold text-dark-900 tracking-wider">
              Welcome to Maintainex
            </p>
            <div className="h-0.5 w-12 md:w-20 bg-dark-900/50" />
          </div>
        )}

        {showStep >= 3 && (
          <div className="mt-6 transition-all duration-500">
            <p className="text-lg md:text-xl text-dark-900/80">
              Shine Beyond Expectations
            </p>
          </div>
        )}
      </div>

      {/* Footer message */}
      <div className="absolute bottom-8 text-dark-900/60 text-sm">
        {isExiting ? 'See you soon!' : 'Loading...'}
      </div>
    </div>
  )
}
