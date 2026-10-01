import type { ApprovalStatus } from './types'

export const APPROVAL_TRANSITIONS: Readonly<Record<ApprovalStatus, readonly ApprovalStatus[]>> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['PENDING_APPROVAL', 'ON_HOLD', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  PENDING_APPROVAL: ['APPROVED', 'ON_HOLD', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  ON_HOLD: ['PENDING_APPROVAL', 'REJECTED', 'CANCELLED', 'EXPIRED'],
  APPROVED: ['EXECUTING', 'CANCELLED', 'EXPIRED'],
  EXECUTING: ['SUCCEEDED', 'FAILED'],
  FAILED: ['RETRY_PENDING'],
  RETRY_PENDING: ['EXECUTING', 'CANCELLED', 'EXPIRED'],
  SUCCEEDED: [],
  REJECTED: [],
  CANCELLED: [],
  EXPIRED: [],
}

export function canTransitionApproval(from: ApprovalStatus, to: ApprovalStatus): boolean {
  return APPROVAL_TRANSITIONS[from].includes(to)
}

export function assertApprovalTransition(from: ApprovalStatus, to: ApprovalStatus): void {
  if (!canTransitionApproval(from, to)) {
    throw new Error(`Invalid approval transition: ${from} -> ${to}`)
  }
}

export function isTerminalApprovalStatus(status: ApprovalStatus): boolean {
  return APPROVAL_TRANSITIONS[status].length === 0
}
