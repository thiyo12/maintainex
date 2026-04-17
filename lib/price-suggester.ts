import { PRICING, DEFAULT_PRICING, getCategoryForSlug, PriceRange } from './pricing'

export interface PriceSuggestion {
  suggestedPrice: number
  reasoning: string
  minPrice: number
  maxPrice: number
  confidence: 'high' | 'medium' | 'low'
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
}

function findBestMatch(serviceName: string, description: string, categorySlug: string): PriceRange | null {
  const searchTexts = [
    normalizeText(serviceName),
    normalizeText(description),
    categorySlug,
  ]

  const combinedSearch = searchTexts.join(' ')

  for (const [categoryKey, categoryPricing] of Object.entries(PRICING)) {
    for (const [serviceKey, priceRange] of Object.entries(categoryPricing)) {
      if (combinedSearch.includes(serviceKey) || serviceKey.includes(combinedSearch)) {
        return priceRange
      }

      const serviceKeyParts = serviceKey.split('-')
      const searchParts = combinedSearch.split('-')

      const hasOverlap = serviceKeyParts.some(part => 
        searchParts.some(searchPart => 
          part.length > 2 && searchPart.includes(part)
        )
      )

      if (hasOverlap) {
        return priceRange
      }
    }
  }

  for (const [categoryKey, categoryPricing] of Object.entries(PRICING)) {
    if (combinedSearch.includes(categoryKey)) {
      const basePrice = Object.values(categoryPricing)[0]
      return basePrice || DEFAULT_PRICING
    }
  }

  return null
}

function calculateComplexityMultiplier(serviceName: string, description: string): number {
  const lowComplexity = ['cleaning', 'basic', 'simple', 'light', 'quick', 'mini']
  const mediumComplexity = ['repair', 'fix', 'install', 'assembly', 'mounting']
  const highComplexity = ['deep', 'heavy', 'full', 'complete', 'complex', 'large', 'commercial']

  const text = `${serviceName} ${description}`.toLowerCase()

  let multiplier = 1.0

  for (const keyword of highComplexity) {
    if (text.includes(keyword)) multiplier = Math.max(multiplier, 1.3)
  }

  for (const keyword of mediumComplexity) {
    if (text.includes(keyword)) multiplier = Math.max(multiplier, 1.1)
  }

  for (const keyword of lowComplexity) {
    if (text.includes(keyword)) multiplier = Math.min(multiplier, 0.9)
  }

  return multiplier
}

function generateReasoning(
  serviceName: string,
  categorySlug: string | null,
  priceRange: PriceRange,
  complexityMultiplier: number
): string {
  const categoryName = categorySlug 
    ? categorySlug.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    : 'general services'

  let reasoning = `Based on Sri Lanka market rates for ${categoryName}. `

  if (complexityMultiplier > 1.2) {
    reasoning += 'This is a complex service, so the price is on the higher end. '
  } else if (complexityMultiplier < 0.95) {
    reasoning += 'This appears to be a basic/quick service. '
  }

  reasoning += `Standard rates in Sri Lanka range from Rs. ${priceRange.min.toLocaleString()} to Rs. ${priceRange.max.toLocaleString()}.`

  return reasoning
}

export function suggestPrice(
  serviceName: string,
  categorySlug: string | null,
  description: string = ''
): PriceSuggestion {
  const normalizedName = normalizeText(serviceName)
  const normalizedDesc = normalizeText(description)
  const combinedCategory = categorySlug ? categorySlug.toLowerCase() : ''

  let priceRange = findBestMatch(normalizedName, normalizedDesc, combinedCategory)

  if (!priceRange) {
    priceRange = DEFAULT_PRICING
  }

  let confidence: 'high' | 'medium' | 'low' = 'medium'

  const hasExactMatch = 
    normalizedName.includes(normalizedDesc) ||
    normalizedDesc.includes(normalizedName)

  const categoryMatch = combinedCategory && 
    (normalizedName.includes(combinedCategory) || 
     normalizedDesc.includes(combinedCategory))

  if (hasExactMatch && categoryMatch) {
    confidence = 'high'
  } else if (hasExactMatch || categoryMatch) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  const complexityMultiplier = calculateComplexityMultiplier(serviceName, description)

  const basePrice = priceRange.base * complexityMultiplier

  const suggestedPrice = Math.round(basePrice / 100) * 100

  const minPrice = Math.round(priceRange.min * complexityMultiplier / 100) * 100
  const maxPrice = Math.round(priceRange.max * complexityMultiplier / 100) * 100

  const reasoning = generateReasoning(serviceName, categorySlug, priceRange, complexityMultiplier)

  return {
    suggestedPrice,
    reasoning,
    minPrice,
    maxPrice,
    confidence,
  }
}

export function formatPrice(price: number): string {
  return `Rs. ${price.toLocaleString()}`
}
