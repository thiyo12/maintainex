'use client'

import { useState, useEffect } from 'react'
import { FiZap, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi'
import { suggestPrice, formatPrice, type PriceSuggestion as PriceSuggestionType } from '@/lib/price-suggester'

interface PriceSuggestionProps {
  serviceName: string
  categorySlug: string | null
  description?: string
  currentPrice?: number | null
  onAccept: (price: number) => void
  onReject: () => void
}

export default function PriceSuggestionCard({
  serviceName,
  categorySlug,
  description = '',
  currentPrice,
  onAccept,
  onReject,
}: PriceSuggestionProps) {
  const [suggestion, setSuggestion] = useState<PriceSuggestionType | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (serviceName.length >= 3) {
      generateSuggestion()
    }
  }, [serviceName, categorySlug, description])

  const generateSuggestion = async () => {
    setIsLoading(true)
    
    await new Promise(resolve => setTimeout(resolve, 500))

    const result = suggestPrice(serviceName, categorySlug, description)
    setSuggestion(result)
    setIsLoading(false)
    setIsVisible(true)
  }

  const handleAccept = () => {
    if (suggestion) {
      onAccept(suggestion.suggestedPrice)
      setIsVisible(false)
    }
  }

  const handleReject = () => {
    onReject()
    setIsVisible(false)
  }

  if (!isVisible || !suggestion) {
    return null
  }

  const isCurrentPriceGood = currentPrice && 
    currentPrice >= suggestion.minPrice && 
    currentPrice <= suggestion.maxPrice

  const priceDiff = currentPrice && suggestion.suggestedPrice
    ? Math.abs(currentPrice - suggestion.suggestedPrice)
    : 0

  const priceDiffPercent = currentPrice && suggestion.suggestedPrice
    ? Math.round((priceDiff / suggestion.suggestedPrice) * 100)
    : 0

  return (
    <div className="mt-3 p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl border border-primary-100">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${isLoading ? 'bg-primary-100 animate-pulse' : 'bg-primary-100'}`}>
          <FiZap className={`w-5 h-5 text-primary-600 ${isLoading ? '' : 'animate-pulse'}`} />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-gray-900 text-sm">
              {isLoading ? 'Analyzing market rates...' : 'AI Price Suggestion'}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              suggestion.confidence === 'high' ? 'bg-green-100 text-green-700' :
              suggestion.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {suggestion.confidence} confidence
            </span>
          </div>

          {!isLoading && (
            <>
              <div className="text-2xl font-bold text-primary-600 mb-2">
                {formatPrice(suggestion.suggestedPrice)}
              </div>

              {currentPrice && currentPrice > 0 && (
                <div className={`text-sm mb-2 flex items-center gap-1 ${
                  isCurrentPriceGood ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {isCurrentPriceGood ? (
                    <>
                      <FiCheck className="w-4 h-4" />
                      <span>Current price is within market range</span>
                    </>
                  ) : (
                    <>
                      <FiAlertCircle className="w-4 h-4" />
                      <span>
                        Current price differs by {priceDiffPercent}% from suggestion
                      </span>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-gray-500 hover:text-gray-700 mb-2"
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>

              {showDetails && (
                <div className="text-sm text-gray-600 mb-3 space-y-1">
                  <p>{suggestion.reasoning}</p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">Range:</span>
                    <span className="font-medium">{formatPrice(suggestion.minPrice)}</span>
                    <span className="text-gray-400">-</span>
                    <span className="font-medium">{formatPrice(suggestion.maxPrice)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAccept}
                  className="flex-1 flex items-center justify-center gap-1 bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
                >
                  <FiCheck className="w-4 h-4" />
                  Accept {formatPrice(suggestion.suggestedPrice)}
                </button>
                <button
                  onClick={handleReject}
                  className="flex items-center justify-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-3 rounded-lg text-sm transition-colors"
                >
                  <FiX className="w-4 h-4" />
                  Keep Current
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function PriceSuggestionButton({
  onClick
}: {
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-blue-500 hover:from-primary-600 hover:to-blue-600 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-all shadow-sm hover:shadow-md"
    >
      <FiZap className="w-4 h-4" />
      <span>🤖 AI Suggest Price</span>
    </button>
  )
}
