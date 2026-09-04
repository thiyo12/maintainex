import { prisma } from '@/lib/prisma'

export interface SmartPricingRequest {
  templateId: string
  answers: Record<string, string | string[]>
  countryCode?: string
  urgency?: string
  city?: string
  scheduledFor?: 'today' | 'tomorrow' | 'this_week' | 'flexible'
}

export interface SmartPriceEstimate {
  currency: string
  symbol: string
  priceRange: { min: number; max: number; base: number }
  breakdown: { label: string; factor: number }[]
  timeEstimateMinutes: number
  confidence: 'high' | 'medium' | 'low'
}

const SYMBOLS: Record<string, string> = { LKR: 'Rs ', CAD: '$ ', USD: '$ ' }

const LOCATION_MULTIPLIERS: Record<string, number> = {
  colombo: 1.3,
  kandy: 1.2,
  galle: 1.1,
  jaffna: 1.0,
  toronto: 25,
  default: 0.9,
}

const TIME_MULTIPLIERS: Record<string, number> = {
  today: 1.2,
  tomorrow: 1.1,
  this_week: 1.0,
  flexible: 0.95,
}

function roundTo(amount: number, isLkr: boolean): number {
  return isLkr ? Math.round(amount / 100) * 100 : Math.round(amount)
}

function getSymbol(currency: string): string {
  return SYMBOLS[currency] || currency + ' '
}

function parseQuestions(questionsJson: string): { questions: any[] } {
  try {
    const parsed = JSON.parse(questionsJson)
    if (Array.isArray(parsed)) return { questions: parsed }
    if (parsed && Array.isArray(parsed.questions)) return parsed
    return { questions: [] }
  } catch {
    return { questions: [] }
  }
}

function answerEffect(questions: any[], answers: Record<string, string | string[]>): { factor: number; contributions: { label: string; factor: number }[] } {
  let factor = 1
  const contributions: { label: string; factor: number }[] = []
  for (const q of questions) {
    const selected = answers[q.key]
    if (selected == null) continue
    const picks = Array.isArray(selected) ? selected : [selected]
    let qFactor = 1
    const optionValues: string[] = (q.options || []).map((o: any) => o.value)
    for (const pick of picks) {
      const opt = (q.options || []).find((o: any) => o.value === pick)
      if (opt && typeof opt.priceEffect === 'number') {
        qFactor *= opt.priceEffect
      } else if (q.type === 'number') {
        const n = Number(pick)
        if (!Number.isNaN(n) && n > 0 && optionValues.length === 0) qFactor *= Math.min(3, 1 + (n - 1) * 0.1)
      }
    }
    if (qFactor !== 1) {
      factor *= qFactor
      contributions.push({ label: q.label, factor: roundTo(qFactor, false) })
    }
  }
  return { factor, contributions }
}

export async function getSmartPriceEstimate(req: SmartPricingRequest): Promise<SmartPriceEstimate> {
  const template = await prisma.serviceTemplate.findUnique({ where: { id: req.templateId } })
  if (!template) {
    throw new Error('Service template not found')
  }

  const { questions } = parseQuestions(template.questionsJson)
  const { factor, contributions } = answerEffect(questions, req.answers || {})

  const urgencyFactor = req.urgency === 'emergency' ? 1.5 : req.urgency === 'urgent' ? 1.2 : 1

  const city = (req.city || '').toLowerCase().trim()
  const locationFactor = LOCATION_MULTIPLIERS[city] || LOCATION_MULTIPLIERS.default
  const timeFactor = TIME_MULTIPLIERS[req.scheduledFor || 'flexible'] || TIME_MULTIPLIERS.flexible
  const totalFactor = factor * urgencyFactor * locationFactor * timeFactor

  const baseMin = template.priceMin > 0 ? template.priceMin : template.priceMax > 0 ? template.priceMax * 0.6 : 0
  const baseMax = template.priceMax > 0 ? template.priceMax : baseMin > 0 ? baseMin * 1.6 : 0

  const min = roundTo(baseMin * totalFactor, template.currency === 'LKR')
  const max = roundTo(baseMax * totalFactor, template.currency === 'LKR')
  const base = roundTo((min + max) / 2, template.currency === 'LKR')

  return {
    currency: template.currency,
    symbol: getSymbol(template.currency),
    priceRange: { min, max, base },
    breakdown: [
      ...contributions,
      ...(locationFactor !== 1 ? [{ label: city, factor: roundTo(locationFactor, false) }] : []),
      ...(timeFactor !== 1 ? [{ label: req.scheduledFor as string, factor: roundTo(timeFactor, false) }] : []),
    ],
    timeEstimateMinutes: Math.round(template.defaultDurationMinutes * factor),
    confidence: contributions.length > 0 ? 'medium' : 'low',
  }
}
