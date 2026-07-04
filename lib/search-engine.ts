import { prisma } from './prisma'

interface SynonymDict {
  [key: string]: string[]
}

const SYNONYMS: SynonymDict = {
  cleaning: ['clean', 'wash', 'mop', 'sweep', 'wipe', 'dust', 'vacuum', 'scrub', 'sanitize', 'disinfect', 'tidy', 'housekeeping'],
  electrical: ['electric', 'wire', 'wiring', 'circuit', 'breaker', 'outlet', 'switch', 'socket', 'power', 'lighting', 'led'],
  plumbing: ['plumber', 'pipe', 'leak', 'drip', 'drain', 'faucet', 'tap', 'toilet', 'sink', 'water', 'sewage', 'flush'],
  painting: ['paint', 'painter', 'colour', 'color', 'coat', 'wall', 'ceiling', 'primer', 'brush', 'roller', 'decor'],
  moving: ['move', 'relocate', 'pack', 'transport', 'shift', 'removal', 'carry', 'haul', 'furniture', 'box'],
  gardening: ['garden', 'lawn', 'mow', 'trim', 'hedge', 'tree', 'landscape', 'grass', 'plant', 'weed', ' outdoor'],
  repairs: ['fix', 'repair', 'broken', 'damage', 'restore', 'maintenance', 'service', 'troubleshoot'],
  assembly: ['assemble', 'build', 'put together', 'furniture', 'ikea', 'shelf', 'wardrobe', 'desk'],
  ac: ['aircon', 'air conditioner', 'hvac', 'cooling', 'heating', 'fan', 'ventilation', 'compressor'],
  pest: ['pest', 'insect', 'bug', 'cockroach', 'rat', 'rodent', 'termite', 'ant', 'mosquito', 'fumigate'],
  renovation: ['renovate', 'remodel', 'upgrade', 'overhaul', 'refurbish', 'rebuild'],
  automotive: ['car', 'vehicle', 'auto', 'motor', 'engine', 'brake', 'tyre', 'battery', 'wash'],
  digital: ['website', 'app', 'design', 'logo', 'graphic', 'seo', 'marketing', 'social media', 'software'],
  carpentry: ['carpenter', 'wood', 'timber', 'furniture', 'cabinet', 'door', 'window', 'frame', 'woodwork'],
}

const SINHALA_KEYWORDS: Record<string, string[]> = {
  cleaning: ['පිරිසිදු', 'සුද්ධ', 'තැවරුම්'],
  electrical: ['විදුලි', 'බලය', 'සොකට්'],
  plumbing: ['පයිප්', 'නල', 'ගැලපුම්'],
  moving: ['ගෙන යාම', 'ඉවත් කිරීම'],
}

const TAMIL_KEYWORDS: Record<string, string[]> = {
  cleaning: ['சுத்தம்', 'துடைப்பு'],
  electrical: ['மின்சார', 'மின்'],
  plumbing: ['குழாய்', 'நீர்'],
  moving: ['நகர்த்து', 'கொண்டு செல்'],
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\u0D80-\u0DFF\s]/g, '').trim()
}

function editDistance(a: string, b: string): number {
  const la = a.length, lb = b.length
  const d: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0))
  for (let i = 0; i <= la; i++) d[i][0] = i
  for (let j = 0; j <= lb; j++) d[0][j] = j
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return d[la][lb]
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - editDistance(a, b) / maxLen
}

function matchCategory(query: string, category: string, synonyms: string[]): { score: number; corrected?: string } {
  const nq = normalize(query)
  const nc = normalize(category)

  if (nq === nc) return { score: 100 }
  if (nq.includes(nc) || nc.includes(nq)) return { score: 95 }

  for (const syn of synonyms) {
    const ns = normalize(syn)
    if (nq === ns) return { score: 90 }
    if (nq.includes(ns) || ns.includes(nq)) return { score: 85 }
    const sim = similarity(nq, ns)
    if (sim > 0.75 && Math.abs(nq.length - ns.length) <= 3) {
      return { score: Math.round(sim * 85), corrected: syn }
    }
  }

  const words = nq.split(/\s+/)
  for (const word of words) {
    for (const syn of synonyms) {
      const synWords = normalize(syn).split(/\s+/)
      for (const sw of synWords) {
        if (word === sw) return { score: 80 }
        if (similarity(word, sw) > 0.8) return { score: Math.round(similarity(word, sw) * 80) }
      }
    }
  }

  const catSim = similarity(nq, nc)
  if (catSim > 0.6) return { score: Math.round(catSim * 70) }

  return { score: 0 }
}

export interface SearchResult {
  categoryId: string
  categoryName: string
  score: number
  correctedText?: string
}

export function searchCategories(query: string): SearchResult[] {
  const results: SearchResult[] = []

  for (const [category, synonyms] of Object.entries(SYNONYMS)) {
    const result = matchCategory(query, category, synonyms)
    if (result.score >= 30) {
      results.push({
        categoryId: category,
        categoryName: category.charAt(0).toUpperCase() + category.slice(1),
        score: result.score,
        correctedText: result.corrected,
      })
    }
  }

  for (const [category, keywords] of Object.entries(SINHALA_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalize(query).includes(kw) || kw.includes(normalize(query))) {
        const existing = results.find(r => r.categoryId === category)
        if (!existing) {
          results.push({ categoryId: category, categoryName: category.charAt(0).toUpperCase() + category.slice(1), score: 80 })
        } else {
          existing.score = Math.max(existing.score, 80)
        }
      }
    }
  }

  for (const [category, keywords] of Object.entries(TAMIL_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalize(query).includes(kw) || kw.includes(normalize(query))) {
        const existing = results.find(r => r.categoryId === category)
        if (!existing) {
          results.push({ categoryId: category, categoryName: category.charAt(0).toUpperCase() + category.slice(1), score: 80 })
        } else {
          existing.score = Math.max(existing.score, 80)
        }
      }
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

export async function logSearch(userId: string | null, query: string, categoryId: string | null, confidence: number | null, clickedId: string | null, countryCode?: string): Promise<void> {
  try {
    await prisma.searchLog.create({
      data: {
        userId: userId || null,
        query,
        categoryMatch: categoryId || null,
        confidence,
        clickedId: clickedId || null,
        countryCode: countryCode || null,
      },
    })
  } catch {}
}

export async function getPopularSearches(countryCode?: string, limit: number = 10): Promise<{ query: string; count: number }[]> {
  try {
    const logs = await prisma.searchLog.findMany({
      where: countryCode ? { countryCode } : {},
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })
    const counts: Record<string, number> = {}
    for (const log of logs) {
      const q = normalize(log.query)
      if (q.length >= 2) counts[q] = (counts[q] || 0) + 1
    }
    return Object.entries(counts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  } catch { return [] }
}
