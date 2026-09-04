import { prisma } from './prisma'

export async function createNotification(data: {
  userId: string
  title: string
  body: string
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
          ? JSON.stringify({ referenceType: data.referenceType, referenceId: data.referenceId })
          : null,
      },
    })
  } catch (error) {
    console.error('Create notification error:', error)
  }
}

export async function notifyQuoteSubmitted(jobId: string, customerId: string, providerName: string) {
  return createNotification({
    userId: customerId,
    title: 'New Quote Received',
    body: `${providerName} submitted a quote for your job`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyQuoteAccepted(jobId: string, providerId: string, jobTitle: string) {
  return createNotification({
    userId: providerId,
    title: 'Quote Accepted',
    body: `Your quote for "${jobTitle}" was accepted`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyEscrowDeposited(jobId: string, providerId: string, jobTitle: string) {
  return createNotification({
    userId: providerId,
    title: 'Escrow Deposited',
    body: `Customer deposited escrow for "${jobTitle}"`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyJobCompleted(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: 'Job Completed',
    body: `Your job "${jobTitle}" has been completed`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyCompletionRequested(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: 'Completion Requested',
    body: `Provider marked "${jobTitle}" as complete. Please review and approve.`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyJobStarted(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: 'Job Started',
    body: `Your provider has started work on "${jobTitle}"`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyPaymentReleased(jobId: string, providerId: string, jobTitle: string, amount: number) {
  return createNotification({
    userId: providerId,
    title: 'Payment Released',
    body: `LKR ${amount} released for "${jobTitle}"`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyEscrowTimeout(jobId: string, providerId: string) {
  return createNotification({
    userId: providerId,
    title: 'Job Available Again',
    body: 'Customer did not fund escrow — job is available again',
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

export async function notifyJobEscalated(jobId: string, customerId: string, jobTitle: string) {
  return createNotification({
    userId: customerId,
    title: '⚠️ Tasker Required — No Response for 2 Hours',
    body: `No tasker responded to "${jobTitle}" within the response window. Our team is arranging one for you.`,
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
      referenceType: 'JOB',
      referenceId: jobId,
    }),
    createNotification({
      userId: taskerId,
      title: 'New Assignment',
      body: `Admin assigned you to "${jobTitle}". Please review the job details and submit a quote.`,
      referenceType: 'JOB',
      referenceId: jobId,
    }),
  ])
}
