import { prisma } from './prisma'
import { formatCurrency } from './currency-format'
import type { Currency } from './money'
import { sendExpoPush, type PushOptions } from './push'

export interface NotificationInput {
  userId: string
  title: string
  body: string
  titleKey?: string
  bodyKey?: string
  params?: Record<string, string>
  referenceType?: string
  referenceId?: string
}

function notificationData(data: NotificationInput): Record<string, unknown> {
  return {
    ...(data.referenceType ? { referenceType: data.referenceType } : {}),
    ...(data.referenceId ? { referenceId: data.referenceId } : {}),
    ...(data.titleKey ? { titleKey: data.titleKey } : {}),
    ...(data.bodyKey ? { bodyKey: data.bodyKey } : {}),
    ...(data.params ? { params: data.params } : {}),
  }
}

export async function createNotification(data: NotificationInput) {
  try {
    const payload = notificationData(data)
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        data: Object.keys(payload).length > 0 ? JSON.stringify(payload) : null,
      },
    })
  } catch (error) {
    console.error('Create notification error:', error)
    return null
  }
}

export async function deliverNotification(
  data: NotificationInput,
  pushOptions: PushOptions & { data?: Record<string, unknown> } = {},
): Promise<{ stored: boolean; pushed: boolean }> {
  const record = await createNotification(data)
  let pushed = false

  try {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { pushToken: true },
    })
    if (user?.pushToken) {
      pushed = await sendExpoPush(
        user.pushToken,
        data.title,
        data.body,
        {
          ...notificationData(data),
          ...(pushOptions.data || {}),
        },
        pushOptions,
      )
    }
  } catch (error) {
    console.error('Notification push delivery error:', error)
  }

  return { stored: Boolean(record), pushed }
}

const jobPush: PushOptions = {
  channelId: 'job_updates',
  priority: 'high',
  interruptionLevel: 'time-sensitive',
}

export async function notifyQuoteSubmitted(jobId: string, customerId: string, providerName: string) {
  return deliverNotification({
    userId: customerId,
    title: 'New Quote Received',
    body: `${providerName} submitted a quote for your job`,
    titleKey: 'notification.quote_submitted.title',
    bodyKey: 'notification.quote_submitted.body',
    params: { providerName },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'QUOTE_SUBMITTED', jobId },
  })
}

export async function notifyQuoteRevised(jobId: string, customerId: string, providerName: string) {
  return deliverNotification({
    userId: customerId,
    title: 'Quote Updated',
    body: `${providerName} updated their price or job details`,
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'QUOTE_REVISED', jobId },
  })
}

export async function notifyQuoteAccepted(jobId: string, providerId: string, jobTitle: string) {
  return deliverNotification({
    userId: providerId,
    title: 'Quote Accepted',
    body: `Your quote for "${jobTitle}" was accepted`,
    titleKey: 'notification.quote_accepted.title',
    bodyKey: 'notification.quote_accepted.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'QUOTE_ACCEPTED', jobId },
  })
}

export async function notifyEscrowDeposited(jobId: string, providerId: string, jobTitle: string) {
  return deliverNotification({
    userId: providerId,
    title: 'Protected Payment Ready',
    body: `Customer funded protected payment for "${jobTitle}"`,
    titleKey: 'notification.escrow_deposited.title',
    bodyKey: 'notification.escrow_deposited.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'ESCROW_FUNDED', jobId },
  })
}

export async function notifyJobCompleted(jobId: string, customerId: string, jobTitle: string) {
  return deliverNotification({
    userId: customerId,
    title: 'Job Completed',
    body: `Your job "${jobTitle}" has been completed`,
    titleKey: 'notification.job_completed.title',
    bodyKey: 'notification.job_completed.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'JOB_COMPLETED', jobId },
  })
}

export async function notifyCompletionRequested(jobId: string, customerId: string, jobTitle: string) {
  return deliverNotification({
    userId: customerId,
    title: 'Completion Requested',
    body: `Provider marked "${jobTitle}" as complete. Please review and approve.`,
    titleKey: 'notification.completion_requested.title',
    bodyKey: 'notification.completion_requested.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'COMPLETION_REQUESTED', jobId },
  })
}

export async function notifyJobStarted(jobId: string, customerId: string, jobTitle: string) {
  return deliverNotification({
    userId: customerId,
    title: 'Job Started',
    body: `Your provider has started work on "${jobTitle}"`,
    titleKey: 'notification.job_started.title',
    bodyKey: 'notification.job_started.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'JOB_STARTED', jobId },
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
  return deliverNotification({
    userId: providerId,
    title: 'Payment Released',
    body: `${formattedAmount} released for "${jobTitle}"`,
    titleKey: 'notification.payment_released.title',
    bodyKey: 'notification.payment_released.body',
    params: { amount: formattedAmount, jobTitle, countryCode },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'PAYMENT_RELEASED', jobId },
  })
}

export async function notifyEscrowTimeout(jobId: string, providerId: string) {
  return deliverNotification({
    userId: providerId,
    title: 'Job Available Again',
    body: 'Customer did not fund protected payment — the job is available again.',
    titleKey: 'notification.escrow_timeout.title',
    bodyKey: 'notification.escrow_timeout.body',
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'ESCROW_TIMEOUT', jobId },
  })
}

export async function notifyPayoutProcessed(userId: string, title: string, body: string) {
  return deliverNotification({
    userId,
    title,
    body,
    referenceType: 'WALLET',
  }, {
    channelId: 'payments',
    priority: 'high',
    interruptionLevel: 'active',
    data: { type: 'PAYOUT_PROCESSED' },
  })
}

export async function notifyJobEscalated(jobId: string, customerId: string, jobTitle: string) {
  return deliverNotification({
    userId: customerId,
    title: 'Tasker Required — No Response Yet',
    body: `No provider responded to "${jobTitle}" within the response window. We are expanding the search.`,
    titleKey: 'notification.job_escalated.title',
    bodyKey: 'notification.job_escalated.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'JOB_ESCALATED', jobId },
  })
}

export async function notifyTaskerAssigned(jobId: string, customerId: string, taskerId: string, taskerName: string, jobTitle: string) {
  return Promise.all([
    deliverNotification({
      userId: customerId,
      title: 'Tasker Assigned',
      body: `${taskerName} has been assigned to your job "${jobTitle}".`,
      titleKey: 'notification.tasker_assigned.title',
      bodyKey: 'notification.tasker_assigned.body',
      params: { taskerName, jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
    }, {
      ...jobPush,
      data: { type: 'TASKER_ASSIGNED', jobId },
    }),
    deliverNotification({
      userId: taskerId,
      title: 'New Assignment',
      body: `You were assigned to "${jobTitle}". Review the job details and schedule.`,
      titleKey: 'notification.new_assignment.title',
      bodyKey: 'notification.new_assignment.body',
      params: { jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
    }, {
      channelId: 'job_offers',
      priority: 'high',
      interruptionLevel: 'time-sensitive',
      data: { type: 'COMPANY_ASSIGNMENT', jobId },
    }),
  ])
}

export async function notifyWorkerAssigned(jobId: string, workerUserId: string, jobTitle: string, companyName: string) {
  return deliverNotification({
    userId: workerUserId,
    title: 'New Company Job',
    body: `${companyName} assigned you to "${jobTitle}".`,
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    channelId: 'job_offers',
    priority: 'high',
    interruptionLevel: 'time-sensitive',
    data: { type: 'COMPANY_ASSIGNMENT', jobId },
  })
}

export async function notifyJobCancelled(jobId: string, userId: string, jobTitle: string, cancelledBy: string) {
  return deliverNotification({
    userId,
    title: 'Job Cancelled',
    body: `"${jobTitle}" was cancelled by ${cancelledBy}.`,
    referenceType: 'JOB',
    referenceId: jobId,
  }, {
    ...jobPush,
    data: { type: 'JOB_CANCELLED', jobId },
  })
}
