import { prisma } from './prisma'

// Property-specific synonyms for NLP search
const PROPERTY_SYNONYMS: Record<string, string[]> = {
  house: ['home', 'villa', 'bungalow', 'residence', 'dwelling', 'mansion'],
  apartment: ['flat', 'condo', 'condominium', 'unit', 'studio', 'penthouse'],
  commercial: ['office', 'retail', 'shop', 'store', 'warehouse', 'showroom'],
  land: ['plot', 'terrain', 'acreage', 'lot', 'ground'],
  rent: ['lease', 'rental', 'let', 'hiring'],
  sale: ['sell', 'buying', 'purchase', 'selling'],
  furnished: ['furnished', 'fitted', 'equipped', 'furnished'],
  bedroom: ['bed', 'bedroom', 'sleeping'],
  bathroom: ['bath', 'bathroom', 'shower'],
  parking: ['garage', 'carport', 'parking', 'car space'],
  modern: ['new', 'contemporary', 'modern', 'updated'],
  luxury: ['premium', 'luxury', 'high-end', 'upscale'],
  garden: ['yard', 'garden', 'lawn', 'outdoor'],
  pool: ['swimming', 'pool', 'swimming pool'],
  view: ['view', 'scenic', 'panoramic', 'overlooking'],
  close: ['near', 'close', 'nearby', 'adjacent', 'walking distance'],
  school: ['school', 'university', 'college', 'education'],
  hospital: ['hospital', 'medical', 'clinic', 'healthcare'],
  market: ['market', 'shopping', 'mall', 'supermarket'],
  transport: ['bus', 'train', 'station', 'transit', 'metro'],
}

// Location synonyms
const LOCATION_SYNONYMS: Record<string, string[]> = {
  colombo: ['colombo', 'col', 'kompitiya'],
  kandy: ['kandy', 'kandy city', 'mahnuwara'],
  galle: ['galle', 'gala'],
  jaffna: ['jaffna', 'yapanaya', 'yarpana'],
  negombo: ['negombo', 'migamuwa'],
  matara: ['matara', 'matura'],
  toronto: ['toronto', 'the six', 't-dot'],
  vancouver: ['vancouver', 'van', 'yvr'],
  montreal: ['montreal', 'mtl', 'montréal'],
  mississauga: ['mississauga', 'mississauga'],
  brampton: ['brampton', 'brampt'],
}

// Normalize text: lowercase, strip special chars, handle Sinhala/Tamil Unicode
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0D80-\u0DFF\u0B80-\u0BFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Edit distance (Levenshtein)
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  return dp[m][n]
}

// Similarity score between two strings
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - editDistance(a, b) / maxLen
}

// Find synonyms for a word
function findSynonyms(word: string): string[] {
  const synonyms: string[] = []
  for (const [key, values] of Object.entries(PROPERTY_SYNONYMS)) {
    if (key === word || values.includes(word)) {
      synonyms.push(key, ...values)
    }
  }
  return [...new Set(synonyms)]
}

// Detect property type from query
function detectPropertyType(query: string): string | null {
  const normalized = normalize(query)
  if (/\b(apartment|flat|condo|unit|studio|penthouse)\b/.test(normalized)) return 'apartment'
  if (/\b(commercial|office|retail|shop|store|warehouse)\b/.test(normalized)) return 'commercial'
  if (/\b(land|plot|terrain|acreage|lot)\b/.test(normalized)) return 'land'
  if (/\b(rental|rent)\b/.test(normalized)) return 'rental'
  if (/\b(house|home|villa|bungalow|residence)\b/.test(normalized)) return 'house'
  return null
}

// Detect purpose from query
function detectPurpose(query: string): string | null {
  const normalized = normalize(query)
  if (/\b(for sale|sell|selling|buying|purchase)\b/.test(normalized)) return 'sale'
  if (/\b(for rent|rent|lease|rental|let|hiring)\b/.test(normalized)) return 'rent'
  if (/\b(commercial lease|commercial)\b/.test(normalized)) return 'commercial'
  if (/\b(land sale|land)\b/.test(normalized)) return 'land'
  return null
}

// Detect location from query
function detectLocation(query: string): { district?: string; city?: string; area?: string } {
  const normalized = normalize(query)
  const result: { district?: string; city?: string; area?: string } = {}

  // Check known cities
  for (const [city, synonyms] of Object.entries(LOCATION_SYNONYMS)) {
    for (const syn of synonyms) {
      if (normalized.includes(syn)) {
        result.city = city.charAt(0).toUpperCase() + city.slice(1)
        return result
      }
    }
  }

  // Check for common Sri Lankan district names
  const lkDistricts = ['colombo', 'kandy', 'galle', 'matara', 'jaffna', 'negombo', 'kurunegala', 'anuradhapura', 'polonnaruwa', 'badulla', 'monaragala', 'ratnapura', 'kegalle', 'trincomalee', 'batticaloa', 'ampara', 'kilinochchi', 'mullaitivu', 'vavuniya', 'mannar', 'hambantota', 'nuwara eliya', 'matale']
  for (const district of lkDistricts) {
    if (normalized.includes(district)) {
      result.district = district.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      return result
    }
  }

  // Check Canadian cities
  const caCities = ['toronto', 'mississauga', 'brampton', 'markham', 'richmond hill', 'vaughan', 'oakville', 'burlington', 'ajax', 'oshawa', 'vancouver', 'surrey', 'burnaby', 'montreal']
  for (const city of caCities) {
    if (normalized.includes(city)) {
      result.city = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      return result
    }
  }

  return result
}

interface PropertySearchResult {
  id: string
  title: string
  description: string | null
  propertyType: string
  purpose: string
  priceLkr: number
  countryCode: string
  district: string | null
  city: string | null
  area: string | null
  address: string | null
  bedrooms: number | null
  bathrooms: number | null
  areaSqft: number | null
  photos: string | null
  isFurnished: boolean
  isFeatured: boolean
  boostTier: string | null
  views: number
  score: number
  createdAt: Date
}

interface SearchOptions {
  query: string
  countryCode?: string
  district?: string
  city?: string
  area?: string
  propertyType?: string
  purpose?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  bathrooms?: number
  parking?: number
  isFurnished?: boolean
  isNewProperty?: boolean
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'most_viewed'
  page?: number
  limit?: number
}

export async function searchProperties(options: SearchOptions): Promise<{
  results: PropertySearchResult[]
  total: number
  page: number
  totalPages: number
}> {
  const {
    query,
    countryCode,
    district,
    city,
    area,
    propertyType: filterType,
    purpose: filterPurpose,
    minPrice,
    maxPrice,
    bedrooms,
    bathrooms,
    parking,
    isFurnished,
    isNewProperty,
    sortBy = 'newest',
    page = 1,
    limit = 20,
  } = options

  // Parse natural language query
  const detectedType = detectPropertyType(query)
  const detectedPurpose = detectPurpose(query)
  const detectedLocation = detectLocation(query)

  // Build where clause
  const where: any = {
    status: 'approved',
  }

  // Country filter
  if (countryCode) where.countryCode = countryCode

  // Location filters (explicit > detected)
  if (district) where.district = { contains: district }
  else if (detectedLocation.district) where.district = { contains: detectedLocation.district }

  if (city) where.city = { contains: city }
  else if (detectedLocation.city) where.city = { contains: detectedLocation.city }

  if (area) where.area = { contains: area }
  else if (detectedLocation.area) where.area = { contains: detectedLocation.area }

  // Property type filter (explicit > detected)
  if (filterType) where.propertyType = filterType
  else if (detectedType) where.propertyType = detectedType

  // Purpose filter (explicit > detected)
  if (filterPurpose) where.purpose = filterPurpose
  else if (detectedPurpose) where.purpose = detectedPurpose

  // Price range
  if (minPrice || maxPrice) {
    where.priceLkr = {}
    if (minPrice) where.priceLkr.gte = minPrice
    if (maxPrice) where.priceLkr.lte = maxPrice
  }

  // Specs filters
  if (bedrooms) where.bedrooms = { gte: bedrooms }
  if (bathrooms) where.bathrooms = { gte: bathrooms }
  if (parking) where.parking = { gte: parking }
  if (isFurnished !== undefined) where.isFurnished = isFurnished
  if (isNewProperty !== undefined) where.isNewProperty = isNewProperty

  // Text search on title and description
  const searchTerms = normalize(query).split(' ').filter(t => t.length > 1)
  if (searchTerms.length > 0) {
    where.OR = searchTerms.map(term => ({
      OR: [
        { title: { contains: term } },
        { description: { contains: term } },
        { address: { contains: term } },
      ],
    }))
  }

  // Sort
  let orderBy: any = { createdAt: 'desc' }
  if (sortBy === 'price_asc') orderBy = { priceLkr: 'asc' }
  else if (sortBy === 'price_desc') orderBy = { priceLkr: 'desc' }
  else if (sortBy === 'most_viewed') orderBy = { views: 'desc' }

  // Execute query
  const skip = (page - 1) * limit

  const [listings, total] = await Promise.all([
    prisma.realEstateListing.findMany({
      where,
      orderBy: [
        { isFeatured: 'desc' },
        { boostTier: 'desc' },
        orderBy,
      ],
      skip,
      take: limit,
    }),
    prisma.realEstateListing.count({ where }),
  ])

  // Calculate search scores for ranking
  const results = listings.map(listing => {
    let score = 50 // base score

    // Title match
    const titleLower = (listing.title || '').toLowerCase()
    const queryLower = query.toLowerCase()
    if (titleLower.includes(queryLower)) score += 40
    else if (searchTerms.some(t => titleLower.includes(t))) score += 20

    // Type match
    if (detectedType && listing.propertyType === detectedType) score += 15

    // Purpose match
    if (detectedPurpose && listing.purpose === detectedPurpose) score += 15

    // Location match
    if (detectedLocation.city && listing.city?.toLowerCase().includes(detectedLocation.city.toLowerCase())) score += 20
    if (detectedLocation.district && listing.district?.toLowerCase().includes(detectedLocation.district.toLowerCase())) score += 15

    // Boost/Featured bonus
    if (listing.isFeatured) score += 30
    if (listing.boostTier === 'top') score += 25
    else if (listing.boostTier === 'premium') score += 20
    else if (listing.boostTier === 'basic') score += 15

    return {
      ...listing,
      score,
    }
  })

  // Sort by score
  results.sort((a, b) => b.score - a.score)

  return {
    results,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  }
}

// Log search for analytics
export async function logPropertySearch(query: string, userId?: string, resultCount: number = 0) {
  try {
    // Use existing SearchLog model if available, otherwise just log to console
    console.log(`[PropertySearch] query="${query}" userId=${userId || 'anonymous'} results=${resultCount}`)
  } catch {
    // Silently fail - search logging is not critical
  }
}

// Get popular property searches
export async function getPopularPropertySearches(): Promise<string[]> {
  return [
    'house for sale in colombo',
    'apartment rent kandy',
    'land in jaffna',
    'commercial building toronto',
    'villa negombo',
    'studio colombo 7',
    'townhouse mississauga',
    'office space markham',
  ]
}
