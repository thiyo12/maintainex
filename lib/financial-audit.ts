import { emitSecurityEvent } from '@/lib/security/events'
import { logger } from '@/lib/observability/logger'
import { incrementCounter } from '@/lib/metrics'

export function auditEscrowFund(params: {
  jobId: string
  escrowId: string
  actorId: string
  amount: bigint | number
  currency: string
  requestId?: string
}): void {
  emitSecurityEvent({
    type: 'wallet_deposit',
    actorId: params.actorId,
    actorType: 'user',
    details: { action: 'escrow_fund', jobId: params.jobId, escrowId: params.escrowId, amount: String(params.amount), currency: params.currency },
    requestId: params.requestId,
  })
  logger.info('ESCROW_FUND', { eventType: 'wallet_deposit', jobId: params.jobId, amount: String(params.amount), currency: params.currency, actorId: params.actorId })
  incrementCounter('financial_escrow_fund', 1, { currency: params.currency })
}

export function auditEscrowRelease(params: {
  jobId: string
  escrowId: string
  actorId: string
  amount: bigint | number
  commission: bigint | number
  netAmount: bigint | number
  currency: string
  requestId?: string
}): void {
  emitSecurityEvent({
    type: 'wallet_withdrawal',
    actorId: params.actorId,
    actorType: 'user',
    details: { action: 'escrow_release', jobId: params.jobId, escrowId: params.escrowId, amount: String(params.amount), commission: String(params.commission), netAmount: String(params.netAmount), currency: params.currency },
    requestId: params.requestId,
  })
  logger.info('ESCROW_RELEASE', { eventType: 'wallet_withdrawal', jobId: params.jobId, amount: String(params.amount), commission: String(params.commission), netAmount: String(params.netAmount), currency: params.currency, actorId: params.actorId })
  incrementCounter('financial_escrow_release', 1, { currency: params.currency })
}

export function auditEscrowRefund(params: {
  jobId: string
  escrowId: string
  actorId: string
  refundAmount: bigint | number
  currency: string
  requestId?: string
}): void {
  emitSecurityEvent({
    type: 'wallet_deposit',
    actorId: params.actorId,
    actorType: 'user',
    details: { action: 'escrow_refund', jobId: params.jobId, escrowId: params.escrowId, refundAmount: String(params.refundAmount), currency: params.currency },
    requestId: params.requestId,
  })
  logger.info('ESCROW_REFUND', { eventType: 'wallet_deposit', jobId: params.jobId, refundAmount: String(params.refundAmount), currency: params.currency, actorId: params.actorId })
  incrementCounter('financial_escrow_refund', 1, { currency: params.currency })
}

export function auditPayoutRequest(params: {
  payoutId: string
  actorId: string
  amount: bigint | number
  currency: string
  method: string
  requestId?: string
}): void {
  emitSecurityEvent({
    type: 'wallet_withdrawal',
    actorId: params.actorId,
    actorType: 'user',
    details: { action: 'payout_request', payoutId: params.payoutId, amount: String(params.amount), currency: params.currency, method: params.method },
    requestId: params.requestId,
  })
  logger.info('PAYOUT_REQUEST', { eventType: 'wallet_withdrawal', payoutId: params.payoutId, amount: String(params.amount), currency: params.currency, method: params.method, actorId: params.actorId })
  incrementCounter('financial_payout_request', 1, { currency: params.currency })
}

export function auditCommissionSettlement(params: {
  settlementId: string
  actorId: string
  amount: bigint | number
  currency: string
  requestId?: string
}): void {
  emitSecurityEvent({
    type: 'admin_action',
    actorId: params.actorId,
    actorType: 'admin',
    details: { action: 'commission_settlement', settlementId: params.settlementId, amount: String(params.amount), currency: params.currency },
    requestId: params.requestId,
  })
  logger.info('COMMISSION_SETTLEMENT', { eventType: 'admin_action', settlementId: params.settlementId, amount: String(params.amount), currency: params.currency, actorId: params.actorId })
  incrementCounter('financial_commission_settlement', 1, { currency: params.currency })
}

export function auditWalletFreeze(params: {
  walletId: string
  walletType: 'PROVIDER' | 'CUSTOMER'
  actorId: string
  requestId?: string
}): void {
  emitSecurityEvent({
    type: 'admin_action',
    actorId: params.actorId,
    actorType: 'admin',
    details: { action: 'wallet_freeze', walletId: params.walletId, walletType: params.walletType },
    requestId: params.requestId,
  })
  logger.info('WALLET_FREEZE', { eventType: 'admin_action', walletId: params.walletId, walletType: params.walletType, actorId: params.actorId })
  incrementCounter('financial_wallet_freeze', 1, { walletType: params.walletType })
}

export function auditWalletUnfreeze(params: {
  walletId: string
  walletType: 'PROVIDER' | 'CUSTOMER'
  actorId: string
  requestId?: string
}): void {
  emitSecurityEvent({
    type: 'admin_action',
    actorId: params.actorId,
    actorType: 'admin',
    details: { action: 'wallet_unfreeze', walletId: params.walletId, walletType: params.walletType },
    requestId: params.requestId,
  })
  logger.info('WALLET_UNFREEZE', { eventType: 'admin_action', walletId: params.walletId, walletType: params.walletType, actorId: params.actorId })
  incrementCounter('financial_wallet_unfreeze', 1, { walletType: params.walletType })
}
