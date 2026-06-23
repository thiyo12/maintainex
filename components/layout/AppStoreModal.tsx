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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-card rounded-3xl p-8 max-w-md w-full text-center relative border border-border shadow-xl animate-fade-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <div className="size-16 rounded-2xl bg-amber-soft flex items-center justify-center mx-auto mb-5">
          <Smartphone className="w-8 h-8 text-amber-600" />
        </div>
        <h3 className="text-2xl font-black tracking-[-0.03em] text-ink mb-3">
          We&apos;re still working
        </h3>
        <p className="text-muted-foreground mb-2 leading-relaxed">
          The full account system is coming soon. In the meantime, you can book any service directly — no sign-up needed.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onClose}
            className="bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-6 py-2.5 rounded-full text-sm transition-all active:scale-95"
          >
            Book a Service
          </button>
          <Link
            href="/services"
            onClick={onClose}
            className="text-foreground font-medium px-6 py-2.5 rounded-full border border-border hover:border-amber-300 text-sm transition-all"
          >
            Browse Services
          </Link>
        </div>
      </div>
    </div>
  )
}
