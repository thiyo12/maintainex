import { prisma } from './prisma'
import { COUNTRY_CONFIGS, getCountryConfig, formatPrice } from './pricing-countries'
import {
  PRICING, DEFAULT_PRICING, getCategoryForSlug,
} from './pricing'
import {
  CountryCode, ComplexityLevel, UrgencyLevel, TimeOfDay,
  PriceEstimateRequest, PriceEstimate, PriceBreakdownItem,
  MarketInsight, MarketComparison, Confidence, PricingModelWeights,
  COMPLEXITY_KEYWORDS, URGENCY_MULTIPLIERS, TIME_MULTIPLIERS,
} from './pricing-types'

const BASE_RATES_CAD: Record<string, { base: number; min: number; max: number }> = {
  cleaning: { base: 70, min: 50, max: 120 },
  electrical: { base: 100, min: 80, max: 130 },
  plumbing: { base: 95, min: 74, max: 167 },
  painting: { base: 80, min: 60, max: 120 },
  ac: { base: 120, min: 100, max: 200 },
  moving: { base: 65, min: 50, max: 80 },
  gardening: { base: 60, min: 40, max: 80 },
  carpentry: { base: 80, min: 60, max: 120 },
  digital: { base: 75, min: 50, max: 150 },
  pest: { base: 70, min: 50, max: 100 },
  renovation: { base: 100, min: 80, max: 150 },
  automotive: { base: 90, min: 80, max: 150 },
  repairs: { base: 80, min: 60, max: 130 },
  other: { base: 60, min: 40, max: 100 },
}

function getBaseRate(categoryName: string, countryCode: CountryCode): { base: number; min: number; max: number; isHourly: boolean } {
  const name = (categoryName || '').toLowerCase()
  if (countryCode === 'CA') {
    for (const [key, rate] of Object.entries(BASE_RATES_CAD)) {
      if (name.includes(key)) return { ...rate, isHourly: true }
    }
    return { base: 70, min: 50, max: 120, isHourly: true }
  }
  const slug = getCategoryForSlug(name)
  if (slug && PRICING[slug]) {
    const prices = Object.values(PRICING[slug])
    if (prices.length > 0) return { ...prices[0], isHourly: false }
  }
  for (const [key, catPricing] of Object.entries(PRICING)) {
    if (name.includes(key) || key.includes(name)) {
      const prices = Object.values(catPricing)
      if (prices.length > 0) return { ...prices[0], isHourly: false }
    }
  }
  return { ...DEFAULT_PRICING, isHourly: false }
}

function analyzeComplexity(description: string, title?: string): { level: ComplexityLevel; multiplier: number } {
  const text = `${title || ''} ${description}`.toLowerCase()
  let score = 0
  for (const word of COMPLEXITY_KEYWORDS.complex) {
    if (text.includes(word)) score += 2
  }
  for (const word of COMPLEXITY_KEYWORDS.medium) {
    if (text.includes(word)) score += 1
  }
  for (const word of COMPLEXITY_KEYWORDS.simple) {
    if (text.includes(word)) score -= 1
  }
  if (score >= 3) return { level: 'complex', multiplier: 1.35 }
  if (score >= 1) return { level: 'medium', multiplier: 1.1 }
  return { level: 'simple', multiplier: 0.85 }
}

function analyzeTiming(preferredDate?: string, preferredTime?: TimeOfDay): { surcharge: number; reason: string } {
  if (!preferredDate && !preferredTime) return { surcharge: 0, reason: '' }
  const date = preferredDate ? new Date(preferredDate) : new Date()
  const day = date.getDay()
  const hour = date.getHours()
  if (preferredTime === 'night' || hour >= 20 || hour < 6) {
    return { surcharge: 0.10, reason: 'Night time surcharge' }
  }
  if (day === 0 || day === 6) {
    return { surcharge: 0.20, reason: 'Weekend surcharge' }
  }
  return { surcharge: 0, reason: '' }
}

function estimateDuration(description: string, title?: string, complexity?: ComplexityLevel): number {
  const text = `${title || ''} ${description}`.toLowerCase()
  if (text.includes('full') || text.includes('deep') || text.includes('complete')) return 4
  if (text.includes('repair') || text.includes('fix') || text.includes('install')) return 3
  if (text.includes('assembly') || text.includes('mount')) return 2
  if (text.includes('quick') || text.includes('mini') || text.includes('light')) return 1
  if (complexity === 'complex') return 4
  if (complexity === 'medium') return 3
  return 2
}

function estimateMaterialCost(description: string, title?: string): number {
  const text = `${title || ''} ${description}`.toLowerCase()
  const materialKeywords: Record<string, number> = {
    'parts': 500, 'paint': 1500, 'pipe': 800, 'wire': 600, 'wood': 2000,
    'material': 1000, 'supply': 500, 'fixture': 1200, 'hardware': 400,
  }
  for (const [keyword, cost] of Object.entries(materialKeywords)) {
    if (text.includes(keyword)) return cost
  }
  return 0
}

async function getModelWeights(categoryId: string, countryCode: CountryCode): Promise<PricingModelWeights | null> {
  try {
    const model = await prisma.pricingModel.findUnique({
      where: { categoryId_countryCode: { categoryId, countryCode } },
    })
    if (model) {
      return {
        baseRate: model.baseRate,
        complexityMultiplier: model.complexityMultiplier,
        urgencyMultiplier: model.urgencyMultiplier,
        weekendMultiplier: model.weekendMultiplier,
        nightMultiplier: model.nightMultiplier,
        travelCostPerKm: model.travelCostPerKm,
        materialCostFactor: model.materialCostFactor,
        demandMultiplier: model.demandMultiplier,
      }
    }
  } catch {}
  return null
}

async function getRegionalPriceIndex(categoryId: string, countryCode: CountryCode, areaId?: string, cityId?: string): Promise<{ avgPrice: number; minPrice: number; maxPrice: number; sampleSize: number } | null> {
  try {
    const where: any = { categoryId, countryCode }
    if (areaId) where.areaId = areaId
    if (cityId) where.cityId = cityId
    const index = await prisma.regionalPriceIndex.findFirst({ where, orderBy: { calculatedAt: 'desc' } })
    if (index && index.sampleSize > 0) {
      return { avgPrice: index.avgPrice, minPrice: index.minPrice, maxPrice: index.maxPrice, sampleSize: index.sampleSize }
    }
  } catch {}
  return null
}

function getMarketComparison(price: number, regionalData: { avgPrice: number; minPrice: number; maxPrice: number } | null): MarketInsight {
  if (!regionalData || regionalData.avgPrice <= 0) {
    return { comparison: 'average', percentage: 0, label: 'This is the typical market price range for this service in your location.' }
  }
  const diff = ((price - regionalData.avgPrice) / regionalData.avgPrice) * 100
  const absDiff = Math.abs(Math.round(diff))
  let comparison: MarketComparison
  let label: string
  if (diff < -10) {
    comparison = 'below_average'
    label = `This job is ${absDiff}% below average market price in your area.`
  } else if (diff >= -10 && diff <= 10) {
    comparison = 'average'
    label = 'This is the typical market price range for this service in your location.'
  } else if (diff > 10 && diff <= 30) {
    comparison = 'slightly_above'
    label = `This job is ${absDiff}% above average market price, reflecting premium service.`
  } else {
    comparison = 'premium'
    label = `This job is ${absDiff}% above average market price — premium service pricing.`
  }
  return { comparison, percentage: absDiff, label }
}

function getWarning(price: number, lowWarningThreshold: number, highWarningThreshold: number, avgPrice?: number): string | null {
  if (avgPrice && price < avgPrice * 0.5) {
    return 'This price may be too low to attract qualified professionals in your area.'
  }
  if (avgPrice && price > avgPrice * 2) {
    return 'You may reduce cost by removing urgency or adjusting job details.'
  }
  return null
}

function getSuggestion(urgency: UrgencyLevel, complexity: ComplexityLevel, price: number, avgPrice?: number): string | null {
  if (urgency === 'emergency' && avgPrice && price > avgPrice * 1.3) {
    return 'Switch to "Normal" urgency to reduce cost.'
  }
  if (complexity === 'complex' && avgPrice && price > avgPrice * 1.5) {
    return 'Consider simplifying the job requirements to lower the price.'
  }
  return null
}

function estimateTimeText(estimatedDuration: number, complexity: ComplexityLevel): string {
  let base = estimatedDuration
  if (complexity === 'complex') base = Math.max(base, 3)
  if (complexity === 'simple') base = Math.max(base, 1)
  return `${base}-${base + Math.ceil(base * 0.5)} hours`
}

function cacheKey(req: PriceEstimateRequest): string {
  return `${req.categoryId}|${req.countryCode || 'LK'}|${req.areaId || ''}|${req.cityId || ''}|${req.urgency || 'normal'}|${req.estimatedDuration || 0}|${req.workersCount || 1}`
}

async function getCached(cacheKeyStr: string): Promise<PriceEstimate | null> {
  try {
    const cached = await prisma.pricingCache.findUnique({ where: { cacheKey: cacheKeyStr } })
    if (cached && new Date(cached.expiresAt) > new Date()) {
      return JSON.parse(cached.response)
    }
    if (cached) {
      await prisma.pricingCache.delete({ where: { id: cached.id } })
    }
  } catch {}
  return null
}

async function setCached(cacheKeyStr: string, estimate: PriceEstimate, ttlMinutes: number = 30): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000)
    await prisma.pricingCache.upsert({
      where: { cacheKey: cacheKeyStr },
      create: { cacheKey: cacheKeyStr, response: JSON.stringify(estimate), expiresAt },
      update: { response: JSON.stringify(estimate), expiresAt },
    })
  } catch {}
}

export async function getPriceEstimate(req: PriceEstimateRequest): Promise<PriceEstimate> {
  const countryCode: CountryCode = req.countryCode || 'LK'
  const urgency: UrgencyLevel = req.urgency || 'normal'
  const workersCount = Math.max(1, req.workersCount || 1)
  const config = getCountryConfig(countryCode)

  const cacheKeyStr = cacheKey(req)
  const cached = await getCached(cacheKeyStr)
  if (cached) return cached

  const complexity = analyzeComplexity(req.description, req.title)
  const baseRateData = getBaseRate(req.categoryName || req.categoryId, countryCode)
  const duration = req.estimatedDuration || estimateDuration(req.description, req.title, complexity.level)
  const timing = analyzeTiming(req.preferredDate, req.preferredTime)
  const urgencyMultiplier = URGENCY_MULTIPLIERS[urgency]
  const materialCost = estimateMaterialCost(req.description, req.title)

  const isHourly = baseRateData.isHourly
  const basePrice = isHourly
    ? baseRateData.base * duration * workersCount
    : baseRateData.base * workersCount
  const complexityAdj = basePrice * (complexity.multiplier - 1)
  const urgencyAdj = basePrice * (urgencyMultiplier - 1)
  const timingAdj = timing.surcharge > 0 ? basePrice * timing.surcharge : 0
  const distanceCost = req.areaId ? config.distanceCostPerKm * 5 : 0

  const modelWeights = await getModelWeights(req.categoryId, countryCode)
  const modelMultiplier = modelWeights ? modelWeights.demandMultiplier : 1.0

  const subTotal = (basePrice + complexityAdj + urgencyAdj + timingAdj + distanceCost + materialCost) * modelMultiplier
  const finalBase = Math.round(subTotal / (isHourly ? 1 : 100)) * (isHourly ? 1 : 100)
  const finalMin = Math.round(finalBase * 0.85)
  const finalMax = Math.round(finalBase * 1.25)

  const regionalData = await getRegionalPriceIndex(req.categoryId, countryCode, req.areaId, req.cityId)
  const marketInsight = getMarketComparison(finalBase, regionalData)
  const warning = getWarning(finalBase, 0, 0, regionalData?.avgPrice)
  const suggestion = getSuggestion(urgency, complexity.level, finalBase, regionalData?.avgPrice)
  const confidence: Confidence = regionalData && regionalData.sampleSize > 20 ? 'high' : regionalData && regionalData.sampleSize > 5 ? 'medium' : 'low'

  const breakdown: PriceBreakdownItem[] = [
    { label: `Base Service${isHourly ? ` (${duration}h × ${workersCount} worker${workersCount > 1 ? 's' : ''})` : ''}`, amount: basePrice },
  ]
  if (complexityAdj > 0) {
    breakdown.push({ label: `Complexity (${complexity.level})`, amount: complexityAdj })
  }
  if (urgencyAdj > 0) {
    breakdown.push({ label: 'Urgency', amount: 0, amountRange: { min: 0, max: urgencyAdj } })
  }
  if (timingAdj > 0) {
    breakdown.push({ label: timing.reason, amount: timingAdj })
  }
  if (distanceCost > 0) {
    breakdown.push({ label: 'Distance surcharge', amount: distanceCost })
  }
  if (materialCost > 0) {
    breakdown.push({ label: 'Materials estimate', amount: materialCost })
  }

  if (modelMultiplier > 1.0) {
    breakdown.push({ label: 'Market demand adjustment', amount: Math.round((finalBase - (finalBase / modelMultiplier))) })
  }

  const estimate: PriceEstimate = {
    currency: config.currency,
    symbol: config.symbol,
    priceRange: { min: finalMin, max: finalMax, base: finalBase },
    breakdown,
    marketInsight,
    timeEstimate: estimateTimeText(duration, complexity.level),
    confidence,
    warning,
    suggestion,
  }

  await setCached(cacheKeyStr, estimate)
  return estimate
}

export async function seedDefaultModels(): Promise<void> {
  const categories = ['cleaning', 'electrical', 'plumbing', 'painting', 'ac', 'moving', 'gardening', 'carpentry', 'digital', 'pest', 'renovation', 'automotive', 'repairs', 'other']
  const countries: CountryCode[] = ['LK', 'CA']

  for (const cat of categories) {
    for (const country of countries) {
      const exists = await prisma.pricingModel.findUnique({
        where: { categoryId_countryCode: { categoryId: cat, countryCode: country } },
      })
      if (!exists) {
        const base = country === 'CA' ? BASE_RATES_CAD[cat]?.base || 70 : getBaseRate(cat, 'LK').base
        await prisma.pricingModel.create({
          data: {
            categoryId: cat,
            countryCode: country,
            baseRate: base,
            complexityMultiplier: 1.0,
            urgencyMultiplier: 1.0,
            weekendMultiplier: country === 'CA' ? 1.25 : 1.15,
            nightMultiplier: country === 'CA' ? 1.15 : 1.10,
            travelCostPerKm: country === 'CA' ? 1.5 : 100,
            materialCostFactor: 0.1,
            demandMultiplier: 1.0,
            confidence: 0.5,
          },
        })
      }
    }
  }
}
