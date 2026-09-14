import { createNotification } from './notifications'

// 1. Inspection requested
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
