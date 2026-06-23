'use client'

import { Star, MapPin, ArrowRight } from 'lucide-react'

const SAMPLE_QUOTES = [
  { name: 'Priya K.', rating: 4.8, price: 'LKR 2,200', avatar: 'PK' },
  { name: 'Mohamed R.', rating: 4.9, price: 'LKR 1,800', avatar: 'MR' },
  { name: 'Samantha D.', rating: 4.7, price: 'LKR 2,500', avatar: 'SD' },
]

export default function FeaturedJobCard() {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-border animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
          Featured Job
        </span>
        <span className="text-[10px] font-bold text-amber-600 bg-amber-soft px-2 py-0.5 rounded-full">
          Plumbing
        </span>
      </div>

      <h3 className="text-lg font-bold text-ink mb-3">Fix leaking kitchen tap</h3>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <MapPin className="w-3.5 h-3.5" />
        <span>850 m · Colombo 03</span>
      </div>

      <div className="space-y-2.5 mb-5">
        {SAMPLE_QUOTES.map((q) => (
          <div
            key={q.name}
            className="flex items-center justify-between p-2.5 rounded-xl bg-amber-soft/30 hover:bg-amber-soft/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] font-bold text-amber-700">
                {q.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{q.name}</p>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  {q.rating}
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-ink">{q.price}</span>
          </div>
        ))}
      </div>

      <button className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-5 py-2.5 rounded-full text-sm transition-all active:scale-95">
        Accept best match
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
