import { Sparkles, Bolt, Droplet, Paintbrush, Hammer, Leaf, Laptop, Wrench } from 'lucide-react'

const CATEGORIES = [
  { name: 'Cleaning', icon: Sparkles },
  { name: 'Electrical', icon: Bolt },
  { name: 'Plumbing', icon: Droplet },
  { name: 'Painting', icon: Paintbrush },
  { name: 'Repairs', icon: Hammer },
  { name: 'Gardening', icon: Leaf },
  { name: 'Web Design', icon: Laptop },
  { name: 'Assembly', icon: Wrench },
]

export default function CategoryMarquee() {
  const items = [...CATEGORIES, ...CATEGORIES, ...CATEGORIES]

  return (
    <div className="border-y border-border bg-card/40 py-3 overflow-hidden">
      <div className="flex animate-marquee gap-3 whitespace-nowrap">
        {items.map((cat, i) => {
          const Icon = cat.icon
          return (
            <div
              key={`${cat.name}-${i}`}
              className="inline-flex items-center gap-1.5 bg-background rounded-full px-3 py-1.5 text-sm font-medium text-foreground border border-border"
            >
              <Icon className="w-4 h-4 text-amber-500" />
              <span>{cat.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
