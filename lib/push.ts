import { prisma } from './prisma'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export type PushChannel = 'default' | 'job_offers'

export interface PushOptions {
  channelId?: PushChannel
  sound?: 'default' | null
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
    }

    if (options.channelId) payload.channelId = options.channelId
    if (options.priority) payload.priority = options.priority

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify([payload]),
    })
    if (!res.ok) return

    const result = await res.json()
    const ticket = result?.data?.[0]
    if (ticket?.status === 'error') {
      const errorCode = ticket.details?.error || ''
      if (/DeviceNotRegistered|InvalidTokens|MessageTooBig/.test(errorCode)) {
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
