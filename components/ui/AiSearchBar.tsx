'use client'

import { useState, useCallback, useMemo } from 'react'
import { Sparkles, CheckCircle2, Lightbulb } from 'lucide-react'
import Fuse from 'fuse.js'
import { CATEGORY_KEYWORDS, CATEGORY_SLUGS, DEFAULT_CATEGORY } from '@/lib/category-keywords'

function buildEntries(): { keyword: string; category: string }[] {
  const entries: { keyword: string; category: string }[] = []
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      entries.push({ keyword, category })
    }
  }
  return entries
}

function createFuse(): Fuse<{ keyword: string; category: string }> {
  return new Fuse(buildEntries(), {
    keys: ['keyword'],
    threshold: 0.4,
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
  })
}

function matchCategory(input: string): string {
  const lower = input.toLowerCase().trim()
  if (lower.length < 2) return DEFAULT_CATEGORY
  const fuse = createFuse()
  const results = fuse.search(lower)
  if (results.length > 0 && results[0].score !== undefined && results[0].score < 0.6) {
    return results[0].item.category
  }
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category
    }
  }
  return DEFAULT_CATEGORY
}

export default function AiSearchBar() {
  const [value, setValue] = useState('')
  const [matched, setMatched] = useState<string | null>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setValue(v)
    if (v.length > 1) {
      setMatched(matchCategory(v))
    } else {
      setMatched(null)
    }
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim().length > 1) {
      const cat = matchCategory(value) || DEFAULT_CATEGORY
      const slug = CATEGORY_SLUGS[cat] || cat.toLowerCase().replace(/\s+/g, '-')
      window.location.href = `/services#${slug}`
    }
  }, [value])

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-[540px]">
      <div className="absolute -inset-2 bg-amber-500/40 blur-2xl animate-breathe rounded-[23px]" />
      <div className="absolute -inset-[1px] rounded-[19px] bg-gradient-to-r from-amber-400/40 via-amber-500/30 to-amber-400/40" />

      <div className="relative flex items-center gap-2 bg-card rounded-[19px] px-4 py-2.5 shadow-sm border border-border">
        <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Try: 'fix leaking tap' or 'wbe desing for my cafe'"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted-foreground outline-none font-medium min-w-0"
        />
        <button
          type="submit"
          className="glow-amber inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-4 py-2.5 rounded-full text-xs transition-all active:scale-95 flex-shrink-0"
        >
          Match me
        </button>
      </div>

      {matched && (
        <div className="mt-2 flex items-center gap-1.5 text-emerald-600 text-sm font-medium animate-fade-up">
          <Lightbulb className="w-4 h-4" />
          <span>Matched to <strong>{matched}</strong></span>
        </div>
      )}
    </form>
  )
}
