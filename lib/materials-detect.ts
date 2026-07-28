import { MATERIALS_DB, type MaterialItem, type CategoryMaterials } from './materials-db'

export interface DetectedMaterial {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  source: string
}

export interface MaterialDetectionResult {
  materials: DetectedMaterial[]
  totalMaterialCost: number
  labourRange: { min: number; max: number }
  currency: string
  symbol: string
  confidence: 'high' | 'medium' | 'low'
  hasMaterials: boolean
}

function getScaleFactor(description: string, categoryData: CategoryMaterials): number {
  if (!categoryData.quantityScaleKeywords) return 1.0

  const text = description.toLowerCase()
  let bestMatch: { keyword: string; scale: number } | null = null

  for (const [keyword, scale] of Object.entries(categoryData.quantityScaleKeywords)) {
    if (text.includes(keyword.toLowerCase())) {
      if (!bestMatch || keyword.length > bestMatch.keyword.length) {
        bestMatch = { keyword, scale }
      }
    }
  }

  return bestMatch?.scale ?? 1.0
}

function getMaterialConfidence(hasMaterials: boolean, description: string): 'high' | 'medium' | 'low' {
  if (!hasMaterials) return 'high'
  const text = description.toLowerCase()
  const detailKeywords = ['bedroom', 'room', 'house', 'apartment', 'floor', 'wall', 'kitchen', 'bathroom', 'sqft', 'square']
  const matches = detailKeywords.filter(kw => text.includes(kw))
  if (matches.length >= 2) return 'high'
  if (matches.length === 1) return 'medium'
  return 'low'
}

export function detectMaterials(
  categoryId: string,
  description: string,
  countryCode: string = 'LK'
): MaterialDetectionResult {
  const categoryData = MATERIALS_DB[categoryId]

  if (!categoryData || !categoryData.hasMaterials) {
    const fallback = MATERIALS_DB['other'] || { labourRange: { min: 2000, max: 8000 }, hasMaterials: false }
    return {
      materials: [],
      totalMaterialCost: 0,
      labourRange: fallback.labourRange,
      currency: countryCode === 'CA' ? 'CAD' : 'LKR',
      symbol: countryCode === 'CA' ? 'CAD' : 'LKR',
      confidence: 'high',
      hasMaterials: false,
    }
  }

  const scaleFactor = getScaleFactor(description, categoryData)

  const materials: DetectedMaterial[] = categoryData.materials.map((item: MaterialItem) => {
    const quantity = Math.max(1, Math.round(item.avgQuantity * scaleFactor))
    const totalPrice = item.unitPrice * quantity

    return {
      name: item.name,
      quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice,
      source: item.source,
    }
  })

  const totalMaterialCost = materials.reduce((sum, m) => sum + m.totalPrice, 0)
  const labourMin = Math.round(categoryData.labourRange.min * scaleFactor)
  const labourMax = Math.round(categoryData.labourRange.max * scaleFactor)

  return {
    materials,
    totalMaterialCost,
    labourRange: { min: labourMin, max: labourMax },
    currency: countryCode === 'CA' ? 'CAD' : 'LKR',
    symbol: countryCode === 'CA' ? 'CAD' : 'LKR',
    confidence: getMaterialConfidence(categoryData.hasMaterials, description),
    hasMaterials: true,
  }
}

export function formatMaterialPrice(price: number, symbol: string = 'LKR'): string {
  return `${symbol} ${price.toLocaleString()}`
}
