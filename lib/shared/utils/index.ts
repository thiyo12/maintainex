import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistanceToNow(date: Date | string, options?: { addSuffix?: boolean }): string {
  const now = new Date()
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  const suffix = options?.addSuffix ? ' ago' : ''
  if (diffMins < 1) return options?.addSuffix ? 'just now' : 'less than a minute'
  if (diffMins < 60) return `${diffMins}m${suffix}`
  if (diffHours < 24) return `${diffHours}h${suffix}`
  if (diffDays < 30) return `${diffDays}d${suffix}`
  return d.toLocaleDateString()
}
