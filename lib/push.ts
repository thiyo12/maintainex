import { prisma } from './prisma'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type PushPriority = 'default' | 'normal' | 'high'

export interface PushOptions {
  sound?: 'default' | string | false
  channelId?: string
  priority?: PushPriority
  interruptionLevel?: 'active' | 'critical' | 'passive' | 'time-sensitive'
  categoryId?: string
}

export async function sendExpoPush(
  to: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  options: PushOptions = {},
): Promise<boolean> {
  try {
    const payload: Record<string, unknown> = {
      to,
      title,
      body,
      data,
      sound: options.sound === false ? undefined : (options.sound || 'default'),
      priority: options.priority || 'high',
    }

    if (options.channelId) payload.channelId = options.channelId
    if (options.interruptionLevel) payload.interruptionLevel = options.interruptionLevel
    if (options.categoryId) payload.categoryId = options.categoryId

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]),
    })
    if (!res.ok) return false

    const result = await res.json()
    const ticket = result?.data?.[0]
    if (ticket?.status === 'error') {
      if (/DeviceNotRegistered|InvalidTokens|MessageTooBig/.test(ticket.details?.error || '')) {
        await prisma.user.updateMany({
          where: { pushToken: to },
          data: { pushToken: null },
        })
      }
      return false
    }

    return ticket?.status === 'ok'
  } catch (error) {
    console.error('Expo push send error:', error)
    return false
  }
}
