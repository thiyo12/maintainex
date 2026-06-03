'use client'

import { useState } from 'react'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import type { FaqItem } from '@/lib/faq'

export default function FaqSection({ faqs }: { faqs: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-dark-900 mb-6">Frequently Asked Questions</h2>
      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index
          return (
            <div
              key={index}
              className="border border-gray-200 rounded-xl overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-dark-900 pr-4">{faq.question}</span>
                {isOpen ? (
                  <FiChevronUp className="w-5 h-5 text-primary-600 flex-shrink-0" />
                ) : (
                  <FiChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="p-4 bg-white border-t border-gray-100">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
