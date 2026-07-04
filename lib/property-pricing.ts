import { prisma } from './prisma'

interface PropertyPriceRequest {
  countryCode: string
  district?: string
  city?: string
  propertyType: string
  purpose: string
  bedrooms?: number
  bathrooms?: number
  areaSqft?: number
  landSize?: number
  isFurnished?: boolean
  isNewProperty?: boolean
}

interface PriceBreakdown {
  factor: string
  value: string
  adjustment: string
}

interface PropertyPriceEstimate {
  estimatedMin: number
  estimatedMax: number
  marketAverage: number
  confidence: 'high' | 'medium' | 'low'
  comparison: 'below_average' | 'average' | 'above_average' | 'premium'
  breakdown: PriceBreakdown[]
  currency: string
  symbol: string
}

// Base prices per sqft by country and property type
const BASE_PRICES: Record<string, Record<string, number>> = {
  LK: {
    house: 45000,
    apartment: 55000,
    commercial: 65000,
    land: 25000,
    rental: 50000,
  },
  CA: {
    house: 850,
    apartment: 950,
    commercial: 1100,
    land: 400,
    rental: 900,
  },
}

// District premium multipliers (urban areas cost more)
const DISTRICT_MULTIPLIERS: Record<string, Record<string, number>> = {
  LK: {
    'Western Province': 1.8,
    'Central Province': 1.3,
    'Southern Province': 1.2,
    'Northern Province': 1.0,
    'Eastern Province': 0.9,
    'North Western Province': 1.0,
    'North Central Province': 0.85,
    'Uva Province': 0.8,
    'Sabaragamuwa Province': 0.9,
  },
  CA: {
    'Ontario': 1.5,
    'British Columbia': 1.8,
    'Quebec': 1.2,
    'Alberta': 1.1,
  },
}

// Purpose multipliers
const PURPOSE_MULTIPLIERS: Record<string, number> = {
  sale: 1.0,
  rent: 0.008,    // Monthly rent is roughly 0.8% of sale price
  commercial: 1.2,
  land: 0.6,
}

const CURRENCY_CONFIG: Record<string, { currency: string; symbol: string }> = {
  LK: { currency: 'LKR', symbol: 'Rs.' },
  CA: { currency: 'CAD', symbol: 'CAD' },
}

function roundToNearest(value: number, nearest: number): number {
  return Math.round(value / nearest) * nearest
}

export function estimatePropertyPrice(req: PropertyPriceRequest): PropertyPriceEstimate {
  const countryCode = req.countryCode || 'LK'
  const currConfig = CURRENCY_CONFIG[countryCode] || CURRENCY_CONFIG.LK
  const breakdown: PriceBreakdown[] = []

  // 1. Base price per sqft
  const basePricePerSqft = BASE_PRICES[countryCode]?.[req.propertyType] || BASE_PRICES.LK.house
  const size = req.areaSqft || req.landSize || 1000
  let basePrice = basePricePerSqft * size

  breakdown.push({
    factor: 'Base Price',
    value: `${currConfig.symbol} ${basePricePerSqft.toLocaleString()}/sqft × ${size} sqft`,
    adjustment: `${currConfig.symbol} ${basePrice.toLocaleString()}`,
  })

  // 2. District multiplier
  const districtMult = DISTRICT_MULTIPLIERS[countryCode]?.[req.district || ''] || 1.0
  if (districtMult !== 1.0) {
    basePrice *= districtMult
    breakdown.push({
      factor: 'Location',
      value: req.district || 'Unknown',
      adjustment: `×${districtMult} (${districtMult > 1 ? 'premium' : 'value'} area)`,
    })
  }

  // 3. Purpose adjustment
  const purposeMult = PURPOSE_MULTIPLIERS[req.purpose] || 1.0
  if (req.purpose === 'rent') {
    // For rent, calculate annual then divide by 12
    basePrice = basePrice * 0.008 * 12 / 12
    breakdown.push({
      factor: 'Rental Estimate',
      value: 'Monthly rental calculation',
      adjustment: `${currConfig.symbol} ${basePrice.toLocaleString()}/month`,
    })
  } else if (purposeMult !== 1.0) {
    basePrice *= purposeMult
    breakdown.push({
      factor: 'Property Type',
      value: req.purpose,
      adjustment: `×${purposeMult}`,
    })
  }

  // 4. Bedroom adjustment (+15% per bedroom above 2)
  if (req.bedrooms && req.bedrooms > 2) {
    const bedroomBonus = (req.bedrooms - 2) * 0.15
    basePrice *= (1 + bedroomBonus)
    breakdown.push({
      factor: 'Bedrooms',
      value: `${req.bedrooms} bedrooms`,
      adjustment: `+${Math.round(bedroomBonus * 100)}%`,
    })
  }

  // 5. Bathroom adjustment (+8% per bathroom above 2)
  if (req.bathrooms && req.bathrooms > 2) {
    const bathBonus = (req.bathrooms - 2) * 0.08
    basePrice *= (1 + bathBonus)
    breakdown.push({
      factor: 'Bathrooms',
      value: `${req.bathrooms} bathrooms`,
      adjustment: `+${Math.round(bathBonus * 100)}%`,
    })
  }

  // 6. Furnished premium (+15%)
  if (req.isFurnished) {
    basePrice *= 1.15
    breakdown.push({
      factor: 'Furnished',
      value: 'Yes',
      adjustment: '+15%',
    })
  }

  // 7. New property premium (+10%)
  if (req.isNewProperty) {
    basePrice *= 1.10
    breakdown.push({
      factor: 'Condition',
      value: 'New',
      adjustment: '+10%',
    })
  }

  // Calculate range (±20%)
  const nearest = countryCode === 'LK' ? 100000 : 1000
  const estimatedMin = roundToNearest(basePrice * 0.80, nearest)
  const estimatedMax = roundToNearest(basePrice * 1.20, nearest)
  const marketAverage = roundToNearest(basePrice, nearest)

  // Calculate confidence based on data availability
  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (req.district && req.areaSqft) confidence = 'high'
  else if (req.district || req.areaSqft) confidence = 'medium'

  // Determine comparison
  let comparison: PropertyPriceEstimate['comparison'] = 'average'
  // We'll compare against market average when we have historical data
  comparison = 'average'

  return {
    estimatedMin,
    estimatedMax,
    marketAverage,
    confidence,
    comparison,
    breakdown,
    currency: currConfig.currency,
    symbol: currConfig.symbol,
  }
}

// Get AI price estimate with historical data comparison
export async function getAIPropertyPriceEstimate(req: PropertyPriceRequest): Promise<PropertyPriceEstimate> {
  const estimate = estimatePropertyPrice(req)

  // Try to get historical data for comparison
  try {
    const historical = await prisma.realEstateListing.findMany({
      where: {
        status: 'approved',
        countryCode: req.countryCode,
        propertyType: req.propertyType,
        purpose: req.purpose,
        ...(req.district ? { district: req.district } : {}),
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    })

    if (historical.length > 5) {
      const avgHistorical = historical.reduce((sum, h) => sum + h.priceLkr, 0) / historical.length

      if (estimate.marketAverage < avgHistorical * 0.85) {
        estimate.comparison = 'below_average'
      } else if (estimate.marketAverage > avgHistorical * 1.15) {
        estimate.comparison = 'premium'
      } else if (estimate.marketAverage > avgHistorical * 1.05) {
        estimate.comparison = 'above_average'
      } else {
        estimate.comparison = 'average'
      }

      estimate.breakdown.push({
        factor: 'Market Data',
        value: `${historical.length} comparable listings found`,
        adjustment: `Market avg: ${estimate.symbol} ${avgHistorical.toLocaleString()}`,
      })

      estimate.confidence = historical.length >= 20 ? 'high' : 'medium'
    }
  } catch {
    // Historical data not available, use base estimate
  }

  return estimate
}
