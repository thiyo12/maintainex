import { prisma } from '@/lib/prisma'
import { sendExpoPush } from '@/lib/push'

export async function createNotification(data: {
  userId: string
  title: string
  body: string
  titleKey?: string
  bodyKey?: string
  params?: Record<string, string>
  referenceType?: string
  referenceId?: string
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        data: data.referenceType && data.referenceId
          ? JSON.stringify({
              referenceType: data.referenceType,
              referenceId: data.referenceId,
              ...(data.titleKey ? { titleKey: data.titleKey } : {}),
              ...(data.bodyKey ? { bodyKey: data.bodyKey } : {}),
              ...(data.params ? { params: data.params } : {}),
            })
          : data.titleKey || data.params
            ? JSON.stringify({
                ...(data.titleKey ? { titleKey: data.titleKey } : {}),
                ...(data.bodyKey ? { bodyKey: data.bodyKey } : {}),
                ...(data.params ? { params: data.params } : {}),
              })
            : null,
      },
    })

    const recipient = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { pushToken: true },
    })
    if (recipient?.pushToken) {
      await sendExpoPush(recipient.pushToken, data.title, data.body, {
        notificationId: notification.id,
        ...(data.referenceType ? { referenceType: data.referenceType } : {}),
        ...(data.referenceId ? { referenceId: data.referenceId } : {}),
      })
    }

    return notification
  } catch (error) {
    console.error('Create notification error:', error)
  }
}
