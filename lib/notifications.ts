import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

export async function createNotification(userId: string, type: NotificationType, title: string, message: string, data?: Record<string, unknown>) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
      }
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}
