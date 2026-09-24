import { prisma } from './prisma'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export interface PushOptions {
  sound?: 'default' | null
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
}

export async function sendExpoPush(
  to: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  options: PushOptions = {},
): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      to,
      title,
      body,
      data,
      sound: options.sound === undefined ? 'default' : options.sound,
      priority: options.priority || 'high',
    }

    if (options.channelId) {
      payload.channelId = options.channelId
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([payload]),
    })
    if (!res.ok) return

    const result = await res.json()
    const ticket = result?.data?.[0]
    if (ticket?.status === 'error') {
      if (/DeviceNotRegistered|InvalidTokens|MessageTooBig/.test(ticket.details?.error || '')) {
        await prisma.user.updateMany({
          where: { pushToken: to },
          data: { pushToken: null },
        })
      }
    }
  } catch (error) {
    console.error('Expo push send error:', error)
  }
}
