'use client'

import { useState } from 'react'
import { FiX, FiSend, FiMessageCircle, FiPhone } from 'react-icons/fi'
import toast from 'react-hot-toast'

interface CustomerForWhatsApp {
  name: string
  phone: string
  email?: string
}

interface WhatsAppModalProps {
  customer: CustomerForWhatsApp
  onSend: (message: string) => Promise<void>
  onClose: () => void
  templates?: Array<{ id: string; name: string; message: string }>
}

const MAX_CHARACTERS = 4096

const defaultTemplates = [
  {
    id: 'greeting',
    name: 'Greeting',
    message: `Hi {name},\n\nThank you for choosing Maintainex! We're here to help with all your maintenance needs.\n\nBest regards,\nThe Maintainex Team`,
  },
  {
    id: 'booking_reminder',
    name: 'Booking Reminder',
    message: `Hi {name},\n\nThis is a friendly reminder about your upcoming booking with Maintainex. If you have any questions, feel free to reach out.\n\nBest regards,\nThe Maintainex Team`,
  },
  {
    id: 'follow_up',
    name: 'Service Follow-up',
    message: `Hi {name},\n\nThank you for your recent service with Maintainex! We'd love to hear your feedback. Your satisfaction is our top priority.\n\nBest regards,\nThe Maintainex Team`,
  },
  {
    id: 'promotion',
    name: 'Special Offer',
    message: `Hi {name},\n\nWe have a special offer just for you! Contact us today to learn more about exclusive deals on our maintenance services.\n\nBest regards,\nThe Maintainex Team`,
  },
]

const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('94')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4)}`
  }
  if (cleaned.startsWith('0')) {
    return `+94 ${cleaned.slice(1, 3)} ${cleaned.slice(3)}`
  }
  return phone
}

export default function WhatsAppModal({
  customer,
  onSend,
  onClose,
  templates = defaultTemplates,
}: WhatsAppModalProps) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(true)

  const handleTemplateSelect = (template: typeof templates[0]) => {
    const personalizedMessage = template.message.replace(/{name}/g, customer.name)
    setMessage(personalizedMessage)
    setShowTemplates(false)
  }

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    if (message.length > MAX_CHARACTERS) {
      toast.error(`Message exceeds ${MAX_CHARACTERS} characters`)
      return
    }

    setIsSending(true)
    try {
      await onSend(message)
      toast.success('Message sent successfully')
      onClose()
    } catch {
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const charCount = message.length
  const charPercentage = (charCount / MAX_CHARACTERS) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <FiMessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Send WhatsApp Message</h3>
              <p className="text-sm text-gray-500">via WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold">
                  {customer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{customer.name}</p>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <FiPhone className="w-3 h-3" />
                  <span>{formatPhoneNumber(customer.phone)}</span>
                </div>
              </div>
            </div>
          </div>

          {showTemplates && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Templates
              </label>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-2 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-700">{template.name}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {template.message.slice(0, 40)}...
                    </p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="mt-2 text-sm text-primary-600 hover:text-primary-700"
              >
                Or write a custom message
              </button>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={6}
              maxLength={MAX_CHARACTERS}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs ${charCount > MAX_CHARACTERS ? 'text-red-500' : 'text-gray-500'}`}>
                {charCount.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()} characters
              </span>
              {charPercentage > 90 && (
                <span className="text-xs text-orange-500">
                  {Math.round(100 - charPercentage)}% remaining
                </span>
              )}
            </div>
            {charPercentage > 100 && (
              <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${Math.min(charPercentage, 100)}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg mb-4">
            <FiMessageCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Messages will be sent via WhatsApp. Standard message rates may apply.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim() || isSending || charCount > MAX_CHARACTERS}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSend className="w-4 h-4" />
            {isSending ? 'Sending...' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  )
}
