import { prisma } from './prisma'
import { formatCurrency, getCurrencyForCountry } from './currency-format'
import type { Currency } from './money'
import { sendExpoPush } from './push'

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
    return await prisma.notification.create({
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
  } catch (error) {
    console.error('Create notification error:', error)
  }
}


export async function notifyUser(data: {
  userId: string
  title: string
  body: string
  titleKey?: string
  bodyKey?: string
  params?: Record<string, string>
  referenceType?: string
  referenceId?: string
  pushData?: Record<string, unknown>
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
}) {
  const notification = await createNotification(data)
  const target = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { pushToken: true },
  })
  if (target?.pushToken) {
    await sendExpoPush(
      target.pushToken,
      data.title,
      data.body,
      {
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        ...(data.pushData || {}),
      },
      {
        channelId: data.channelId || (data.referenceType === 'WALLET' ? 'payments' : 'job_updates'),
        priority: data.priority || 'high',
      },
    )
  }
  return notification
}

export async function notifyQuoteSubmitted(jobId: string, customerId: string, providerName: string) {
  return notifyUser({
    userId: customerId,
    title: 'New Quote Received',
    body: `${providerName} submitted a quote for your job`,
    titleKey: 'notification.quote_submitted.title',
    bodyKey: 'notification.quote_submitted.body',
    params: { providerName },
    referenceType: 'JOB',
    referenceId: jobId,
    pushData: { type: 'QUOTE_SUBMITTED', jobId },
  })
}

export async function notifyQuoteRevised(jobId: string, customerId: string, providerName: string) {
  return notifyUser({
    userId: customerId,
    title: 'Quote Updated',
    body: `${providerName} updated the quote for your job`,
    referenceType: 'JOB',
    referenceId: jobId,
    pushData: { type: 'QUOTE_REVISED', jobId },
    channelId: 'job_updates',
    priority: 'high',
  })
}

export async function notifyQuoteAccepted(jobId: string, providerId: string, jobTitle: string) {
  return notifyUser({
    userId: providerId,
    title: 'Quote Accepted',
    body: `Your quote for "${jobTitle}" was accepted`,
    titleKey: 'notification.quote_accepted.title',
    bodyKey: 'notification.quote_accepted.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyEscrowDeposited(jobId: string, providerId: string, jobTitle: string) {
  return notifyUser({
    userId: providerId,
    title: 'Escrow Deposited',
    body: `Customer deposited escrow for "${jobTitle}"`,
    titleKey: 'notification.escrow_deposited.title',
    bodyKey: 'notification.escrow_deposited.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyJobCompleted(jobId: string, customerId: string, jobTitle: string) {
  return notifyUser({
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
  return notifyUser({
    userId: customerId,
    title: 'Completion Requested',
    body: `Provider marked "${jobTitle}" as complete. Please review and approve.`,
    titleKey: 'notification.completion_requested.title',
    bodyKey: 'notification.completion_requested.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyJobStarted(jobId: string, customerId: string, jobTitle: string) {
  return notifyUser({
    userId: customerId,
    title: 'Job Started',
    body: `Your provider has started work on "${jobTitle}"`,
    titleKey: 'notification.job_started.title',
    bodyKey: 'notification.job_started.body',
    params: { jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
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
  return notifyUser({
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
  return notifyUser({
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
  return notifyUser({
    userId,
    title,
    body,
    referenceType: 'WALLET',
  })
}

export async function notifyJobEscalated(jobId: string, customerId: string, jobTitle: string) {
  return notifyUser({
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
    notifyUser({
      userId: customerId,
      title: 'Tasker Assigned',
      body: `${taskerName} has been assigned to your job "${jobTitle}". They will contact you shortly.`,
      titleKey: 'notification.tasker_assigned.title',
      bodyKey: 'notification.tasker_assigned.body',
      params: { taskerName, jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
    }),
    notifyUser({
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
