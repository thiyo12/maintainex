'use client'

import { useState, useCallback } from 'react'
import { Search, Sparkles, CheckCircle2 } from 'lucide-react'

const ROUTES: Record<string, string> = {
  web: 'Web Design',
  desing: 'Web Design',
  website: 'Web Design',
  tap: 'Plumbing',
  leak: 'Plumbing',
  plumb: 'Plumbing',
  pipe: 'Plumbing',
  clean: 'Cleaning',
  cleanin: 'Cleaning',
  mop: 'Cleaning',
  vacuum: 'Cleaning',
}

function matchCategory(input: string): string {
  const lower = input.toLowerCase()
  for (const [keyword, category] of Object.entries(ROUTES)) {
    if (lower.includes(keyword)) return category
  }
  return 'Repairs'
}

export default function AiSearchBar() {
  const [value, setValue] = useState('')
  const [matched, setMatched] = useState<string | null>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setValue(v)
    if (v.length > 2) {
      setMatched(matchCategory(v))
    } else {
      setMatched(null)
    }
  }, [])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (value.length > 2) {
      const cat = matchCategory(value) || 'Repairs'
      window.location.href = `/services#${cat.toLowerCase().replace(' ', '-')}`
    }
  }, [value])

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-[540px]">
      {/* Glow layers */}
      <div className="absolute -inset-2 bg-amber-500/40 blur-2xl animate-breathe rounded-[23px]" />
      <div className="absolute -inset-[1px] rounded-[19px] bg-gradient-to-r from-amber-400/40 via-amber-500/30 to-amber-400/40" />

      {/* Card */}
      <div className="relative flex items-center gap-2 bg-white rounded-[19px] px-4 py-2.5 shadow-sm border border-border">
        <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Try: 'fix leaking tap' or 'wbe desing for my cafe'"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted-foreground outline-none font-medium"
        />
        <button
          type="submit"
          className="glow-amber inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-4 py-2 rounded-full text-xs transition-all active:scale-95"
        >
          Match me
        </button>
      </div>

      {matched && (
        <div className="mt-2 flex items-center gap-1.5 text-emerald-600 text-sm font-medium animate-fade-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>Matched to <strong>{matched}</strong></span>
        </div>
      )}
    </form>
  )
}
