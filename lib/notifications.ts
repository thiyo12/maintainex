import { prisma } from './prisma'
import { formatCurrency } from './currency-format'
import type { Currency } from './money'
import { sendExpoPush, type ExpoPushOptions } from './push'

export type NotificationInput = {
  userId: string
  title: string
  body: string
  titleKey?: string
  bodyKey?: string
  params?: Record<string, string>
  referenceType?: string
  referenceId?: string
  push?: boolean
  pushData?: Record<string, unknown>
  pushSound?: ExpoPushOptions['sound']
  pushPriority?: ExpoPushOptions['priority']
  pushChannelId?: string
}

export async function createNotification(data: NotificationInput) {
  let notification
  try {
    notification = await prisma.notification.create({
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
              ...(data.pushData ? { pushData: data.pushData } : {}),
            })
          : data.titleKey || data.params || data.pushData
            ? JSON.stringify({
                ...(data.titleKey ? { titleKey: data.titleKey } : {}),
                ...(data.bodyKey ? { bodyKey: data.bodyKey } : {}),
                ...(data.params ? { params: data.params } : {}),
                ...(data.pushData ? { pushData: data.pushData } : {}),
              })
            : null,
      },
    })
  } catch (error) {
    console.error('Create notification error:', error)
    return undefined
  }

  if (data.push !== false) {
    try {
      const recipient = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { pushToken: true },
      })

      if (recipient?.pushToken) {
        const referenceData = data.referenceType && data.referenceId
          ? { referenceType: data.referenceType, referenceId: data.referenceId }
          : {}

        await sendExpoPush(
          recipient.pushToken,
          data.title,
          data.body,
          { ...referenceData, ...(data.pushData || {}) },
          {
            sound: data.pushSound === undefined ? 'default' : data.pushSound,
            priority: data.pushPriority || 'high',
            channelId: data.pushChannelId,
          },
        )
      }
    } catch (error) {
      // Push is best-effort; never lose the durable in-app notification.
      console.error('Push notification delivery error:', error)
    }
  }

  return notification
}

export async function notifyQuoteSubmitted(jobId: string, customerId: string, providerName: string) {
  return createNotification({
    userId: customerId,
    title: 'New Quote Received',
    body: `${providerName} submitted a quote for your job`,
    titleKey: 'notification.quote_submitted.title',
    bodyKey: 'notification.quote_submitted.body',
    params: { providerName },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'QUOTE_SUBMITTED', jobId },
  })
}

export async function notifyQuoteRevised(jobId: string, customerId: string, providerName: string) {
  return createNotification({
    userId: customerId,
    title: 'Revised Quote Received',
    body: `${providerName} updated their quote. Review the new price before booking.`,
    params: { providerName },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'QUOTE_REVISED', jobId },
  })
}

export async function notifyQuoteAccepted(jobId: string, providerId: string, jobTitle: string) {
  return createNotification({
    userId: providerId,
    title: 'Quote Accepted',
    body: `Your quote for "${jobTitle}" was accepted`,
    titleKey: 'notification.quote_accepted.title',
    bodyKey: 'notification.quote_accepted.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'QUOTE_ACCEPTED', jobId },
  })
}

export async function notifyEscrowDeposited(jobId: string, providerId: string, jobTitle: string) {
  return createNotification({
    userId: providerId,
    title: 'Escrow Deposited',
    body: `Customer deposited escrow for "${jobTitle}"`,
    titleKey: 'notification.escrow_deposited.title',
    bodyKey: 'notification.escrow_deposited.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'ESCROW_DEPOSITED', jobId },
  })
}

export async function notifyJobCompleted(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: 'Job Completed',
    body: `Your job "${jobTitle}" has been completed`,
    titleKey: 'notification.job_completed.title',
    bodyKey: 'notification.job_completed.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'JOB_COMPLETED', jobId },
  })
}

export async function notifyCompletionRequested(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: 'Completion Requested',
    body: `Provider marked "${jobTitle}" as complete. Please review and approve.`,
    titleKey: 'notification.completion_requested.title',
    bodyKey: 'notification.completion_requested.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'COMPLETION_REQUESTED', jobId },
  })
}

export async function notifyJobStarted(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: 'Job Started',
    body: `Your provider has started work on "${jobTitle}"`,
    titleKey: 'notification.job_started.title',
    bodyKey: 'notification.job_started.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'JOB_STARTED', jobId },
  })
}

export async function notifyPaymentReleased(
  jobId: string,
  providerId: string,
  jobTitle: string,
  amount: number,
  currency: Currency = 'LKR',
  countryCode: string = 'LK',
) {
  const formattedAmount = formatCurrency(BigInt(Math.round(amount * 100)), currency)
  return createNotification({
    userId: providerId,
    title: 'Payment Released',
    body: `${formattedAmount} released for "${jobTitle}"`,
    titleKey: 'notification.payment_released.title',
    bodyKey: 'notification.payment_released.body',
    params: { amount: formattedAmount, jobTitle, countryCode },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'payments',
    pushData: { type: 'PAYMENT_RELEASED', jobId },
  })
}

export async function notifyEscrowTimeout(jobId: string, providerId: string) {
  return createNotification({
    userId: providerId,
    title: 'Job Available Again',
    body: 'Customer did not fund escrow — job is available again',
    titleKey: 'notification.escrow_timeout.title',
    bodyKey: 'notification.escrow_timeout.body',
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'ESCROW_TIMEOUT', jobId },
  })
}

export async function notifyPayoutProcessed(userId: string, title: string, body: string) {
  return createNotification({
    userId,
    title,
    body,
    referenceType: 'WALLET',
    pushChannelId: 'payments',
    pushData: { type: 'PAYOUT_PROCESSED' },
  })
}

export async function notifyJobCancelled(
  jobId: string,
  userId: string,
  jobTitle: string,
  cancelledBy: string,
) {
  return createNotification({
    userId,
    title: 'Job Cancelled',
    body: `${cancelledBy} cancelled "${jobTitle}" before work started.`,
    params: { jobTitle, cancelledBy },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'JOB_CANCELLED', jobId },
  })
}

export async function notifyJobEscalated(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: '⚠️ Tasker Required — No Response for 2 Hours',
    body: `No tasker responded to "${jobTitle}" within the response window. Your job is still open.`,
    titleKey: 'notification.job_escalated.title',
    bodyKey: 'notification.job_escalated.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
    pushChannelId: 'job_updates',
    pushData: { type: 'JOB_ESCALATED', jobId },
  })
}

export async function notifyTaskerAssigned(
  jobId: string,
  customerId: string,
  taskerId: string,
  taskerName: string,
  jobTitle: string,
) {
  return Promise.all([
    createNotification({
      userId: customerId,
      title: 'Tasker Assigned',
      body: `${taskerName} has been assigned to your job "${jobTitle}".`,
      titleKey: 'notification.tasker_assigned.title',
      bodyKey: 'notification.tasker_assigned.body',
      params: { taskerName, jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
      pushChannelId: 'job_updates',
      pushData: { type: 'TASKER_ASSIGNED', jobId },
    }),
    createNotification({
      userId: taskerId,
      title: 'New Assignment',
      body: `You were assigned to "${jobTitle}". Review the job details.`,
      titleKey: 'notification.new_assignment.title',
      bodyKey: 'notification.new_assignment.body',
      params: { jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
      pushChannelId: 'job_offers',
      pushData: { type: 'COMPANY_ASSIGNMENT', jobId, alertMode: 'ring' },
    }),
  ])
}
