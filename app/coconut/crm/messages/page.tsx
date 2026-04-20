'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { 
  FiMessageSquare, FiPhone, FiMail, FiSend, FiUsers, 
  FiSearch, FiRefreshCw, FiCheckCircle, FiClock, FiAlertCircle, FiX
} from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import { getAuthHeader } from '@/lib/auth-client'

interface Segment {
  id: string
  name: string
  memberCount: number
}

interface MessageHistory {
  id: string
  channel: string
  status: string
  recipientCount: number
  successCount: number
  failedCount: number
  message: string
  createdAt: string
  sentAt: string | null
}

export default function CRMMessagesPage() {
  const { user } = useAdminSession()
  const [segments, setSegments] = useState<Segment[]>([])
  const [messageHistory, setMessageHistory] = useState<MessageHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedSegment, setSelectedSegment] = useState<string>('')
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP')
  const [message, setMessage] = useState('')
  const [recipientCount, setRecipientCount] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const fetchData = useCallback(async () => {
    try {
      const authHeaders = getAuthHeader()
      const [segmentsRes, historyRes] = await Promise.all([
        fetch('/api/crm/segments', { headers: { ...authHeaders } }),
        fetch('/api/crm/messages', { headers: { ...authHeaders } })
      ])

      if (segmentsRes.status === 401 || historyRes.status === 401) {
        window.location.href = '/admin/login'
        return
      }

      const [segmentsData, historyData] = await Promise.all([
        segmentsRes.json(),
        historyRes.json()
      ])

      if (segmentsRes.ok) {
        setSegments(segmentsData.segments || [])
      }
      if (historyRes.ok) {
        setMessageHistory(historyData.messages || [])
      }

      setError(null)
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const previewRecipients = useCallback(async () => {
    if (!selectedSegment) {
      setRecipientCount(0)
      return
    }

    try {
      const authHeaders = getAuthHeader()
      const res = await fetch(`/api/crm/segments/${selectedSegment}/customers`, {
        headers: { ...authHeaders }
      })

      if (res.ok) {
        const data = await res.json()
        setRecipientCount(data.customers?.length || 0)
      } else {
        setRecipientCount(0)
      }
    } catch (err) {
      setRecipientCount(0)
    }
  }, [selectedSegment])

  useEffect(() => {
    previewRecipients()
  }, [selectedSegment, previewRecipients])

  const sendMessage = async () => {
    if (!selectedSegment || !message.trim()) {
      toast.error('Please select a segment and enter a message')
      return
    }

    setSending(true)
    try {
      const authHeaders = getAuthHeader()
      const res = await fetch('/api/crm/messages', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders 
        },
        body: JSON.stringify({
          segmentId: selectedSegment,
          channel,
          message: message.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to send message')
        return
      }

      toast.success(`Message queued for ${data.recipientCount || recipientCount} recipients`)
      setShowConfirm(false)
      setMessage('')
      setSelectedSegment('')
      fetchData()
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case 'WHATSAPP':
        return <FiMessageSquare className="w-5 h-5" />
      case 'SMS':
        return <FiPhone className="w-5 h-5" />
      case 'EMAIL':
        return <FiMail className="w-5 h-5" />
      default:
        return <FiMessageSquare className="w-5 h-5" />
    }
  }

  const getChannelColor = (ch: string) => {
    switch (ch) {
      case 'WHATSAPP':
        return 'bg-green-500'
      case 'SMS':
        return 'bg-blue-500'
      case 'EMAIL':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <FiCheckCircle className="w-4 h-4 text-green-500" />
      case 'FAILED':
        return <FiAlertCircle className="w-4 h-4 text-red-500" />
      case 'PENDING':
      case 'QUEUED':
        return <FiClock className="w-4 h-4 text-yellow-500" />
      default:
        return <FiClock className="w-4 h-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Messaging</h1>
          <p className="text-gray-600">Send messages to customer segments</p>
        </div>
        <button onClick={fetchData} className="btn-outline flex items-center">
          <FiRefreshCw className="mr-2" /> Refresh
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Compose Message</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Segment</label>
                <select
                  value={selectedSegment}
                  onChange={(e) => setSelectedSegment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select a segment...</option>
                  {segments.map(segment => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name} ({segment.memberCount} customers)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                <div className="flex gap-3">
                  {(['WHATSAPP', 'SMS', 'EMAIL'] as const).map(ch => (
                    <button
                      key={ch}
                      onClick={() => setChannel(ch)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 transition-colors ${
                        channel === ch 
                          ? 'border-primary-500 bg-primary-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={getChannelColor(ch)}>
                        {getChannelIcon(ch)}
                      </span>
                      <span className="text-sm font-medium">{ch}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  placeholder="Enter your message..."
                />
                <div className="text-sm text-gray-500 text-right mt-1">
                  {message.length} characters
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FiUsers className="text-gray-400" />
                  <span className="text-gray-600">Recipients:</span>
                </div>
                <span className="text-xl font-bold text-gray-900">{recipientCount}</span>
              </div>

              <button
                onClick={() => setShowConfirm(true)}
                disabled={!selectedSegment || !message.trim() || recipientCount === 0}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSend className="mr-2" /> Send Message
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Message History</h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {messageHistory.length > 0 ? (
                messageHistory.map(msg => (
                  <div key={msg.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={getChannelColor(msg.channel)}>
                          {getChannelIcon(msg.channel)}
                        </span>
                        <span className="font-medium text-gray-900">{msg.channel}</span>
                        {getStatusIcon(msg.status)}
                      </div>
                      <span className="text-sm text-gray-500">
                        {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2">{msg.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{msg.recipientCount} recipients</span>
                      {msg.successCount > 0 && (
                        <span className="text-green-600">{msg.successCount} sent</span>
                      )}
                      {msg.failedCount > 0 && (
                        <span className="text-red-600">{msg.failedCount} failed</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <FiMessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No messages sent yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Confirm Message</h2>
              <button onClick={() => setShowConfirm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className={getChannelColor(channel)}>
                    {getChannelIcon(channel)}
                  </span>
                  <span className="font-medium">{channel}</span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{message}</p>
              </div>

              <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FiUsers className="text-primary-600" />
                  <span className="text-primary-700">Recipients:</span>
                </div>
                <span className="text-xl font-bold text-primary-700">{recipientCount}</span>
              </div>

              <p className="text-sm text-gray-500">
                This will send the message to all customers in the selected segment. Continue?
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                onClick={() => setShowConfirm(false)} 
                className="flex-1 btn-secondary"
                disabled={sending}
              >
                Cancel
              </button>
              <button 
                onClick={sendMessage} 
                className="flex-1 btn-primary flex items-center justify-center gap-2"
                disabled={sending}
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <FiSend /> Send
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}