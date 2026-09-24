import { prisma } from './prisma'
import { formatCurrency, getCurrencyForCountry } from './currency-format'
import type { Currency } from './money'
import { sendExpoPush, type ExpoPushOptions } from './push'
import { sendExpoPush, type PushPriority } from './push'

export async function createNotification(data: {
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
  pushSound?: string
  pushPriority?: PushPriority
  pushChannelId?: string
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

    if (data.push !== false) {
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
            sound: data.pushSound || 'default',
            priority: data.pushPriority || 'high',
            channelId: data.pushChannelId,
          },
        )
      }
    }

    return notification
  } catch (error) {
    console.error('Create notification error:', error)
  }
}


export async function createNotificationAndPush(
  data: {
    userId: string
    title: string
    body: string
    titleKey?: string
    bodyKey?: string
    params?: Record<string, string>
    referenceType?: string
    referenceId?: string
  },
  pushData: Record<string, unknown> = {},
  pushOptions: ExpoPushOptions = {},
) {
  const notification = await createNotification(data)

  try {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { pushToken: true },
    })

    if (user?.pushToken) {
      await sendExpoPush(
        user.pushToken,
        data.title,
        data.body,
        {
          ...pushData,
          ...(data.referenceType ? { referenceType: data.referenceType } : {}),
          ...(data.referenceId ? { referenceId: data.referenceId } : {}),
        },
        pushOptions,
      )
    }
  } catch (error) {
    console.error('Push notification delivery error:', error)
  }

  return notification
}

export async function notifyQuoteRevised(jobId: string, customerId: string, providerName: string) {
  return createNotificationAndPush({
    userId: customerId,
    title: 'Revised Quote Received',
    body: `${providerName} updated their quote. Review the new price before booking.`,
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    type: 'QUOTE_REVISED',
    jobId,
  }, { channelId: 'quotes', priority: 'high' })
}

export async function notifyQuoteSubmitted(jobId: string, customerId: string, providerName: string) {
  return createNotificationAndPush({
    userId: customerId,
    title: 'New Quote Received',
    body: `${providerName} submitted a quote for your job`,
    titleKey: 'notification.quote_submitted.title',
    bodyKey: 'notification.quote_submitted.body',
    params: { providerName },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    type: 'QUOTE_SUBMITTED',
    jobId,
  }, { channelId: 'quotes', priority: 'high' })
}

export async function notifyQuoteRevised(jobId: string, customerId: string, providerName: string) {
  return createNotification({
    userId: customerId,
    title: 'Quote Updated',
    body: `${providerName} updated their price for your job`,
    params: { providerName },
    referenceType: 'JOB',
    referenceId: jobId,
    pushData: { type: 'QUOTE_REVISED', jobId },
  })
}

export async function notifyQuoteAccepted(jobId: string, providerId: string, jobTitle: string) {
  return createNotificationAndPush({
    userId: providerId,
    title: 'Quote Accepted',
    body: `Your quote for "${jobTitle}" was accepted`,
    titleKey: 'notification.quote_accepted.title',
    bodyKey: 'notification.quote_accepted.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    type: 'QUOTE_ACCEPTED',
    jobId,
  }, { channelId: 'job-updates', priority: 'high' })
}

export async function notifyEscrowDeposited(jobId: string, providerId: string, jobTitle: string) {
  return createNotificationAndPush({
    userId: providerId,
    title: 'Escrow Deposited',
    body: `Customer deposited escrow for "${jobTitle}"`,
    titleKey: 'notification.escrow_deposited.title',
    bodyKey: 'notification.escrow_deposited.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    type: 'ESCROW_DEPOSITED',
    jobId,
  }, { channelId: 'job-updates', priority: 'high' })
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
  })
}

export async function notifyCompletionRequested(jobId: string, customerId: string, jobTitle: string) {
  return createNotificationAndPush({
    userId: customerId,
    title: 'Completion Requested',
    body: `Provider marked "${jobTitle}" as complete. Please review and approve.`,
    titleKey: 'notification.completion_requested.title',
    bodyKey: 'notification.completion_requested.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    type: 'COMPLETION_REQUESTED',
    jobId,
  }, { channelId: 'job-updates', priority: 'high' })
}

export async function notifyJobStarted(jobId: string, customerId: string, jobTitle: string) {
  return createNotificationAndPush({
    userId: customerId,
    title: 'Job Started',
    body: `Your provider has started work on "${jobTitle}"`,
    titleKey: 'notification.job_started.title',
    bodyKey: 'notification.job_started.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    type: 'JOB_STARTED',
    jobId,
  }, { channelId: 'job-updates', priority: 'high' })
}

export async function notifyPaymentReleased(
  jobId: string,
  providerId: string,
  jobTitle: string,
  amount: number,
  currency: Currency = 'LKR',
  countryCode: string = 'LK'
) {
  const formattedAmount = formatCurrency(BigInt(Math.round(amount * 100)), currency)
  return createNotification({
    userId: providerId,
    title: 'Payment Released',
    body: `${formattedAmount} released for "${jobTitle}"`,
    titleKey: 'notification.payment_released.title',
    bodyKey: 'notification.payment_released.body',
    params: { amount: formattedAmount, jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
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
  })
}

export async function notifyPayoutProcessed(userId: string, title: string, body: string) {
  return createNotification({
    userId,
    title,
    body,
    referenceType: 'WALLET',
  })
}

export async function notifyJobCancelled(jobId: string, userId: string, jobTitle: string, cancelledBy: string) {
  return createNotification({
    userId,
    title: 'Job Cancelled',
    body: `${cancelledBy} cancelled "${jobTitle}" before work started.`,
    params: { jobTitle, cancelledBy },
    referenceType: 'JOB',
    referenceId: jobId,
    pushData: { type: 'JOB_CANCELLED', jobId },
  })
}

export async function notifyJobEscalated(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: '⚠️ Tasker Required — No Response for 2 Hours',
    body: `No tasker responded to "${jobTitle}" within the response window. Our team is arranging one for you.`,
    titleKey: 'notification.job_escalated.title',
    bodyKey: 'notification.job_escalated.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyTaskerAssigned(jobId: string, customerId: string, taskerId: string, taskerName: string, jobTitle: string) {
  return Promise.all([
    createNotification({
      userId: customerId,
      title: 'Tasker Assigned',
      body: `${taskerName} has been assigned to your job "${jobTitle}". They will contact you shortly.`,
      titleKey: 'notification.tasker_assigned.title',
      bodyKey: 'notification.tasker_assigned.body',
      params: { taskerName, jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
    }),
    createNotification({
      userId: taskerId,
      title: 'New Assignment',
      body: `Admin assigned you to "${jobTitle}". Please review the job details and submit a quote.`,
      titleKey: 'notification.new_assignment.title',
      bodyKey: 'notification.new_assignment.body',
      params: { jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
    }),
  ])
}
