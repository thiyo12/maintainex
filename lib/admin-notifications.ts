import { prisma } from './prisma'

type NotificationType = 'kyc_pending' | 'dispute_raised' | 'review_pending' | 'escrow_action' | 'user_flagged' | 'job_reported'

async function getSuperAdminIds(): Promise<string[]> {
  const admins = await prisma.adminUser.findMany({
    where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null },
    select: { id: true },
  })
  return admins.map((a) => a.id)
}

export async function notifyAllAdmins(type: NotificationType, title: string, message: string, link?: string) {
  const adminIds = await getSuperAdminIds()
  if (adminIds.length === 0) return

  await prisma.adminNotification.createMany({
    data: adminIds.map((adminUserId) => ({
      adminUserId,
      type,
      title,
      message,
      link: link || null,
    })),
  })
}

export async function notifyAdmin(adminUserId: string, type: NotificationType, title: string, message: string, link?: string) {
  await prisma.adminNotification.create({
    data: {
      adminUserId,
      type,
      title,
      message,
      link: link || null,
    },
  })
}
