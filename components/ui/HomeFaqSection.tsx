'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

const FAQS = [
  {
    q: 'What types of services does Maintainex offer?',
    a: 'We offer a wide range of home and commercial services including cleaning, plumbing, electrical work, painting, repairs, gardening, pest control, AC servicing, and more. Browse our full catalog on the Services page.',
  },
  {
    q: 'How do I book a service?',
    a: 'Simply type what you need into the AI search bar, select a category, and choose your service. You can book instantly online without creating an account. We&apos;ll connect you with vetted taskers in your area.',
  },
  {
    q: 'Are the taskers vetted and insured?',
    a: 'Yes. Every tasker on Maintainex goes through a verification process including identity checks and skill assessments. All work is backed by our satisfaction guarantee.',
  },
  {
    q: 'What areas do you cover?',
    a: 'We currently serve Colombo, Kandy, Galle, Jaffna, Negombo, and expanding to more cities across Sri Lanka. Enter your location to see available services near you.',
  },
  {
    q: 'How much does it cost?',
    a: 'Pricing varies by service. You&apos;ll see transparent upfront pricing when you select a service. Quotes from taskers include all costs — no hidden fees.',
  },
  {
    q: 'What if I&apos;m not satisfied with the service?',
    a: 'Your payment sits in escrow until the job is completed to your satisfaction. If something&apos;s not right, we&apos;ll work with you and the tasker to make it right.',
  },
]

export default function HomeFaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-24">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <span className="text-[10px] uppercase tracking-[0.15em] text-amber-600 font-semibold">Got questions?</span>
          <h2 className="text-3xl md:text-4xl font-black tracking-[-0.03em] text-ink mt-2">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => {
            const isOpen = openIndex === i
            return (
              <div
                key={i}
                className="bg-card rounded-2xl border border-border overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-ink pr-4 text-sm">{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 border-t border-border">
                    <p className="text-muted-foreground text-sm leading-relaxed pt-4">{faq.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
