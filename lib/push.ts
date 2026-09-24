import { prisma } from './prisma'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

export async function sendExpoPush(
  to: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  options?: { sound?: string; channelId?: string; priority?: 'default' | 'normal' | 'high' }
): Promise<void> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        to,
        title,
        body,
        data,
        sound: options?.sound || 'default',
        ...(options?.channelId ? { channelId: options.channelId } : {}),
        ...(options?.priority ? { priority: options.priority } : {}),
      }]),
    })
    if (!res.ok) return
    const result = await res.json()
    const ticket = result?.data?.[0]
    if (ticket?.status === 'error') {
      // Expired / invalid token — drop it so we stop attempting
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