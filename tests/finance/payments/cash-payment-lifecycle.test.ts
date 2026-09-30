import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('cash payment lifecycle contract', () => {
  const escrow = read('lib/finance/escrow/escrow-service.ts')
  const pin = read('lib/domain/job-pin.ts')
  const lifecycle = read('lib/domain/job-lifecycle.ts')
  const cashRoute = read('app/api/mobile/v2/jobs/[id]/cash-payment/route.ts')
  const completeRoute = read('app/api/mobile/v2/jobs/[id]/complete/route.ts')
  const refundRoute = read('app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts')
  const customer = read('apps/mobile/features/jobs/screens/customer/v2/[id].tsx')
  const tasker = read('apps/mobile/features/jobs/screens/tasker/v2/manage/[id].tsx')
  const company = read('apps/mobile/features/jobs/screens/company/v2/manage/[id].tsx')

  it('selects cash from pending payment without creating funded escrow money', () => {
    expect(cashRoute).toContain('confirmCashPayment')
    expect(cashRoute).toContain("paymentMethod: 'CASH'")
    expect(cashRoute).toContain("status: 'CASH_CONFIRMED'")
    expect(escrow).toContain("status: 'PENDING_PAYMENT'")
    expect(escrow).toContain("paymentMethod: 'CASH'")
    expect(escrow).toContain("status: 'CASH_CONFIRMED'")
    expect(escrow).toContain('heldAt: null')

    const start = escrow.indexOf('export async function confirmCashPayment')
    const end = escrow.indexOf('export async function releaseEscrow', start)
    const cashSelection = escrow.slice(start, end)
    expect(cashSelection).not.toContain('postLedgerTransaction(')
    expect(cashSelection).not.toContain('providerWallet')
  })

  it('accepts cash confirmation as a valid PIN and address-sharing payment state', () => {
    expect(pin).toContain("status: { in: ['PROTECTED', 'CASH_CONFIRMED'] }")
    expect(
      read('app/api/mobile/v2/jobs/[id]/share-address/route.ts'),
    ).toContain("status: { in: ['PROTECTED', 'CASH_CONFIRMED'] }")
  })

  it('keeps work start behind the same one-time PIN state machine for cash', () => {
    expect(pin).toContain("where: { id: jobId, status: 'QUOTE_ACCEPTED' }")
    expect(pin).toContain("data: { status: 'IN_PROGRESS' }")
    expect(pin).toContain("workspace?.progressStatus === 'ACCEPTED'")
    expect(pin).toContain('if (!activePin?.arrivalVerifiedAt) return false')
  })

  it('records weekly platform debt on cash completion without crediting a provider wallet', () => {
    const completeStart = escrow.indexOf('export async function completeAndReleaseEscrow')
    const completeSource = escrow.slice(completeStart)
    const cashStart = completeSource.indexOf("if (escrow.paymentMethod === 'CASH')")
    const fundedWalletStart = completeSource.indexOf('const providerWalletSeed = await tx.providerWallet.upsert', cashStart)
    const cashCompletion = completeSource.slice(cashStart, fundedWalletStart)

    expect(completeStart).toBeGreaterThan(-1)
    expect(cashStart).toBeGreaterThan(-1)
    expect(fundedWalletStart).toBeGreaterThan(cashStart)
    expect(cashCompletion).toContain('recordWeeklySettlement')
    expect(cashCompletion).toContain('platformDueCents')
    expect(cashCompletion).not.toContain('providerWallet.upsert')
    expect(cashCompletion).not.toContain("accountType: 'PROVIDER_WALLET'")
    expect(completeRoute).toContain("result.paymentMethod === 'CASH'")
    expect(completeRoute).toContain('notifyCashJobCompleted')
  })

  it('cancels pre-start cash with zero ledger refund and supports cash disputes', () => {
    expect(escrow).toContain("['CASH_CONFIRMED', 'ON_HOLD'].includes(escrow.status)")
    expect(escrow).toContain('cashNoPlatformFunds: true')
    expect(escrow).toContain('refundAmount: 0')
    expect(lifecycle).toContain("status: { in: ['PROTECTED', 'CASH_CONFIRMED'] }")
    expect(lifecycle).toContain("data: { status: 'ON_HOLD' }")
    expect(refundRoute).toContain("const cashCancelled = 'cashCancelled' in result")
    expect(refundRoute).toContain("refundStatus: pendingExternal ? 'REFUND_REQUIRED' : cashCancelled ? 'CANCELLED' : 'REFUNDED'")
  })

  it('does not auto-release cash jobs without explicit customer/admin approval', () => {
    expect(escrow).toContain("releaseMode === 'AUTO_RELEASE' && escrow.paymentMethod === 'CASH'")
    expect(escrow).toContain('Cash jobs require explicit customer approval or admin resolution')
  })

  it('exposes cash selection and cash-ready work start in the mobile clients', () => {
    expect(customer).toContain('handleCashPayment')
    expect(customer).toContain('v2JobActions.confirmCashPayment(id)')
    expect(customer).toContain("['PROTECTED', 'CASH_CONFIRMED'].includes(escrow.status)")
    expect(tasker).toContain("['PROTECTED', 'CASH_CONFIRMED'].includes(escrow?.status)")
    expect(company).toContain("['PROTECTED', 'CASH_CONFIRMED'].includes(job.escrow?.status)")
  })
})
