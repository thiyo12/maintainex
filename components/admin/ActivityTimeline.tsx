'use client'

import { FiCalendar, FiPhone, FiMail, FiMessageCircle, FiFileText, FiUser, FiStar, FiClock } from 'react-icons/fi'
import { formatDistanceToNow } from '@/lib/utils'

export interface Activity {
  id: string
  type: 'BOOKING_CREATED' | 'BOOKING_COMPLETED' | 'BOOKING_CANCELLED' | 'CALL_MADE' | 'CALL_RECEIVED' | 'EMAIL_SENT' | 'EMAIL_OPENED' | 'WHATSAPP_SENT' | 'WHATSAPP_RECEIVED' | 'NOTE_ADDED' | 'TAG_ADDED' | 'TAG_REMOVED' | 'SEGMENT_ADDED' | 'SEGMENT_REMOVED' | 'STATUS_CHANGED' | 'PROFILE_UPDATED' | 'ADDRESS_ADDED' | 'LOGIN' | 'PAYMENT_RECEIVED'
  title: string
  description?: string | null
  metadata?: string | null
  createdByName?: string | null
  createdByEmail?: string | null
  createdAt: string
  relatedId?: string | null
  relatedType?: string | null
}

interface ActivityTimelineProps {
  activities: Activity[]
  loading?: boolean
}

const activityConfig: Record<string, { icon: typeof FiCalendar; color: string; bgColor: string }> = {
  BOOKING_CREATED: { icon: FiCalendar, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  BOOKING_COMPLETED: { icon: FiCalendar, color: 'text-green-600', bgColor: 'bg-green-100' },
  BOOKING_CANCELLED: { icon: FiCalendar, color: 'text-red-600', bgColor: 'bg-red-100' },
  CALL_MADE: { icon: FiPhone, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  CALL_RECEIVED: { icon: FiPhone, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  EMAIL_SENT: { icon: FiMail, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  EMAIL_OPENED: { icon: FiMail, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  WHATSAPP_SENT: { icon: FiMessageCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  WHATSAPP_RECEIVED: { icon: FiMessageCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  NOTE_ADDED: { icon: FiFileText, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  TAG_ADDED: { icon: FiStar, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  TAG_REMOVED: { icon: FiStar, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  SEGMENT_ADDED: { icon: FiUser, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  SEGMENT_REMOVED: { icon: FiUser, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  STATUS_CHANGED: { icon: FiClock, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  PROFILE_UPDATED: { icon: FiUser, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  ADDRESS_ADDED: { icon: FiFileText, color: 'text-teal-600', bgColor: 'bg-teal-100' },
  LOGIN: { icon: FiUser, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  PAYMENT_RECEIVED: { icon: FiStar, color: 'text-green-600', bgColor: 'bg-green-100' },
}

const formatTimeAgo = (date: string) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export default function ActivityTimeline({ activities, loading = false }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FiClock className="w-6 h-6 text-gray-400" />
          </div>
          <p className="font-medium text-gray-900">No activity yet</p>
          <p className="text-sm text-gray-500 mt-1">Customer activity will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
        <p className="text-sm text-gray-500">{activities.length} activities recorded</p>
      </div>
      <div className="p-6">
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {activities.map((activity, index) => {
              const config = activityConfig[activity.type] || activityConfig.NOTE_ADDED
              const Icon = config.icon
              const isLast = index === activities.length - 1

              return (
                <div key={activity.id} className={`relative flex gap-4 ${isLast ? '' : ''}`}>
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                        {activity.description && (
                          <p className="text-sm text-gray-500 mt-1">{activity.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatTimeAgo(activity.createdAt)}
                      </span>
                    </div>
                    {activity.createdByName && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                        <FiUser className="w-3 h-3" />
                        <span>{activity.createdByName}</span>
                        {activity.createdByEmail && (
                          <span className="text-gray-400">({activity.createdByEmail})</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
