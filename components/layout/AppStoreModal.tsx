'use client'

import { X, Smartphone } from 'lucide-react'
import Link from 'next/link'

interface AppStoreModalProps {
  open: boolean
  onClose: () => void
}

export default function AppStoreModal({ open, onClose }: AppStoreModalProps) {
  if (!open) return null

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border shadow-lg animate-fade-up">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-2xl bg-amber-soft flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink truncate">
              We&apos;re still working
            </p>
            <p className="text-xs text-muted-foreground truncate">
              The full account system is coming soon. Book any service directly — no sign-up needed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => window.location.href = '/booking'}
            className="bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-4 py-1.5 rounded-full text-xs transition-all active:scale-95 whitespace-nowrap"
          >
            Book a Service
          </button>
          <Link
            href="/services"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground font-medium px-3 py-1.5 rounded-full border border-border hover:border-amber-300 text-xs transition-all whitespace-nowrap"
          >
            Browse Services
          </Link>
          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-amber-soft/50 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
