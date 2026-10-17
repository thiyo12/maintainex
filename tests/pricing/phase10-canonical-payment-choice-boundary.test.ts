import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const screen = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/jobs/screens/customer/v2/[id].tsx'), 'utf8')
const canonical = readFileSync(resolve(process.cwd(),
  'apps/mobile/features/jobs/screens/customer/v2/confirm/[id].tsx'), 'utf8')

describe('Phase 10 — only canonical payment chooser can initiate funding from booking UI', () => {
  it('does not directly initiate escrow or cash on the booking detail screen', () => {
    expect(screen).not.toContain('v2JobActions.depositEscrow(')
    expect(screen).not.toContain('v2JobActions.confirmCashPayment(')
    expect(screen).toContain("router.push('/(customer)/jobs/v2/confirm/' + id)")
    expect(screen).toContain('Review Payment Options')
  })

  it('never claims cash will be held as protected escrow', () => {
    expect(screen).toContain('Cash is paid directly to the provider and is not held as escrow.')
    expect(screen).not.toContain('Deposit Now')
    expect(screen).not.toContain('Fund Escrow')
  })

  it('does not offer one-click release before provider work is complete', () => {
    expect(screen).not.toContain('handleReleaseEscrow')
    expect(screen).not.toContain('Release to Hero')
    expect(screen).toContain("workspace?.progressStatus === 'COMPLETION_REQUESTED'")
    expect(screen).toContain('handleApproveCompletion')
  })

  it('canonical payment page loads eligibility before allowing online/cash actions', () => {
    expect(canonical).toContain("v2Payments.status(id)")
    expect(canonical).toContain("canSubmitPayment(paymentPresentation, 'online')")
    expect(canonical).toContain("canSubmitPayment(paymentPresentation, 'cash')")
    expect(canonical).toContain("v2JobActions.confirmCashPayment(id)")
  })
})
