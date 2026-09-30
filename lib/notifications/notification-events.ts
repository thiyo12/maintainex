import { createNotification } from './notification-service'
import { formatCurrency, getCurrencyForCountry } from '@/lib/shared/money/format'
import type { Currency } from '@/lib/shared/money/money'

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
  })
}

export async function notifyJobCancelled(
  jobId: string,
  userId: string,
  jobTitle: string,
  cancelledBy: 'customer' | 'provider',
  reason?: string | null
) {
  return createNotification({
    userId,
    title: 'Job Cancelled',
    body: `Job "${jobTitle}" was cancelled by the ${cancelledBy}${reason ? `: ${reason}` : ''}`,
    titleKey: 'notification.job_cancelled.title',
    bodyKey: 'notification.job_cancelled.body',
    params: { jobTitle, cancelledBy, ...(reason ? { reason } : {}) },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyDisputeRaised(
  jobId: string,
  recipientUserId: string,
  jobTitle: string,
) {
  return createNotification({
    userId: recipientUserId,
    title: 'Job Dispute Raised',
    body: `A dispute was raised for "${jobTitle}". Payment is on hold while it is reviewed.`,
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

export async function notifyDisputeResolved(
  jobId: string,
  recipientUserId: string,
  jobTitle: string,
  outcome: 'RELEASE_PROVIDER' | 'REFUND_CUSTOMER' | 'REFUND_PROCESSING',
) {
  const copy = outcome === 'RELEASE_PROVIDER'
    ? {
        title: 'Dispute Resolved',
        body: `The dispute for "${jobTitle}" was resolved and payment was released to the provider.`,
      }
    : outcome === 'REFUND_CUSTOMER'
      ? {
          title: 'Dispute Resolved',
          body: `The dispute for "${jobTitle}" was resolved with a customer refund.`,
        }
      : {
          title: 'Dispute Refund Processing',
          body: `A customer refund was approved for "${jobTitle}" and is being reconciled with the payment gateway.`,
        }

  return createNotification({
    userId: recipientUserId,
    title: copy.title,
    body: copy.body,
    referenceType: 'JOB',
    referenceId: jobId,
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

export async function notifyCompanyWorkerAssigned(
  jobId: string,
  workerUserId: string,
  jobTitle: string,
  companyName: string,
) {
  return createNotification({
    userId: workerUserId,
    title: 'New Company Assignment',
    body: `${companyName} assigned you to "${jobTitle}". Review and accept the assignment before starting work.`,
    referenceType: 'COMPANY_JOB',
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

export async function notifyInspectionRequested(
  jobId: string,
  customerId: string,
  providerId: string,
  jobTitle: string,
) {
  await Promise.all([
    createNotification({
      userId: providerId,
      title: 'Inspection Requested',
      body: `Customer requested an inspection for "${jobTitle}"`,
      titleKey: 'notification.inspection_requested.title',
      bodyKey: 'notification.inspection_requested.body',
      params: { jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
    }),
    createNotification({
      userId: customerId,
      title: 'Inspection Scheduled',
      body: `An inspection has been requested for "${jobTitle}". You will be notified when the provider arrives.`,
      titleKey: 'notification.inspection_scheduled.title',
      bodyKey: 'notification.inspection_scheduled.body',
      params: { jobTitle },
      referenceType: 'JOB',
      referenceId: jobId,
    }),
  ])
}

// 2. Provider arrived at inspection
export async function notifyInspectionArrived(
  jobId: string,
  customerId: string,
  providerName: string,
  jobTitle: string,
) {
  return createNotification({
    userId: customerId,
    title: 'Provider Arrived',
    body: `${providerName} has arrived for the inspection of "${jobTitle}". Please confirm their arrival.`,
    titleKey: 'notification.inspection_arrived.title',
    bodyKey: 'notification.inspection_arrived.body',
    params: { providerName, jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

// 3. Inspection completed
export async function notifyInspectionCompleted(
  jobId: string,
  customerId: string,
  providerName: string,
  jobTitle: string,
) {
  return createNotification({
    userId: customerId,
    title: 'Inspection Completed',
    body: `${providerName} completed the inspection for "${jobTitle}". A quote will follow.`,
    titleKey: 'notification.inspection_completed.title',
    bodyKey: 'notification.inspection_completed.body',
    params: { providerName, jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

// 4. Change order submitted
export async function notifyChangeOrderSubmitted(
  jobId: string,
  customerId: string,
  providerName: string,
  jobTitle: string,
  changeOrderNumber: number,
) {
  return createNotification({
    userId: customerId,
    title: 'Change Order Submitted',
    body: `${providerName} submitted change order #${changeOrderNumber} for "${jobTitle}"`,
    titleKey: 'notification.change_order_submitted.title',
    bodyKey: 'notification.change_order_submitted.body',
    params: { providerName, jobTitle, changeOrderNumber: String(changeOrderNumber) },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

// 5. Change order approved
export async function notifyChangeOrderApproved(
  jobId: string,
  providerId: string,
  jobTitle: string,
  changeOrderNumber: number,
) {
  return createNotification({
    userId: providerId,
    title: 'Change Order Approved',
    body: `Change order #${changeOrderNumber} for "${jobTitle}" was approved`,
    titleKey: 'notification.change_order_approved.title',
    bodyKey: 'notification.change_order_approved.body',
    params: { jobTitle, changeOrderNumber: String(changeOrderNumber) },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

// 6. Change order rejected
export async function notifyChangeOrderRejected(
  jobId: string,
  providerId: string,
  jobTitle: string,
  changeOrderNumber: number,
) {
  return createNotification({
    userId: providerId,
    title: 'Change Order Rejected',
    body: `Change order #${changeOrderNumber} for "${jobTitle}" was rejected`,
    titleKey: 'notification.change_order_rejected.title',
    bodyKey: 'notification.change_order_rejected.body',
    params: { jobTitle, changeOrderNumber: String(changeOrderNumber) },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}

// 7. Risk event detected (admin notification — use system user or admin role)
export async function notifyRiskEventDetected(
  jobId: string,
  eventType: string,
  jobTitle: string,
  adminUserId: string,
) {
  return createNotification({
    userId: adminUserId,
    title: 'Risk Event Detected',
    body: `${eventType} detected on "${jobTitle}"`,
    titleKey: 'notification.risk_event_detected.title',
    bodyKey: 'notification.risk_event_detected.body',
    params: { eventType, jobTitle },
    referenceType: 'JOB',
    referenceId: jobId,
  })
}
