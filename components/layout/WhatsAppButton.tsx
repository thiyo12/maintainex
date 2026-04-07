'use client'

import { FiMessageCircle } from 'react-icons/fi'
import { useState, useEffect } from 'react'

export default function WhatsAppButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('94770867609')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.whatsappNumber) {
          setPhoneNumber(data.whatsappNumber)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-20 right-0 bg-white rounded-2xl shadow-2xl p-6 w-80 mb-2 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-600 font-semibold text-sm">Live Support</span>
          </div>
          <h4 className="font-bold text-dark-900 mb-2">Chat with us on WhatsApp!</h4>
          <p className="text-gray-600 text-sm mb-4">
            Get instant responses. Click below to start chatting with our team.
          </p>
          <a
            href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent('Hi, I would like to know more about your cleaning services.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white text-center py-3 rounded-lg font-semibold transition-colors"
          >
            <FiMessageCircle className="text-xl" />
            Start Chat Now
          </a>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 relative"
        aria-label="Chat on WhatsApp"
      >
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold animate-pulse">!</span>
        </div>
        <FiMessageCircle className="text-white text-3xl" />
      </button>
    </div>
  )
}
