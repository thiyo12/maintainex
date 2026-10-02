'use strict'

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// MaintainEX runs PayPal as the only active online payment provider.
//
// This bootstrap deliberately does NOT create provider rows:
//   * PayHere (LK/LKR) is legacy and must never be auto-created or
//     auto-activated for new checkout.
//   * PayPal stays operator-governed per market, so nothing is auto-created here.
//
// Its only job is to make sure any pre-existing PayHere row that an earlier
// release auto-bootstrapped is safely DISABLED for new checkout, while the row
// itself is preserved so historical jobs, payment intents, refunds, ledger
// entries and audits that reference PayHere remain readable.
//
// No PayHere PaymentIntent, provider transaction/refund/event, ledger or audit
// row is ever deleted or modified here.
async function main() {
  const legacyConfigs = await prisma.paymentProviderConfig.findMany({
    where: { provider: 'PAYHERE' },
    select: {
      id: true,
      countryCode: true,
      enabled: true,
      operationalStatus: true,
    },
  })

  if (legacyConfigs.length === 0) {
    console.log(
      '[payment-provider-bootstrap] no PayHere provider config present; nothing to disable'
    )
    return
  }

  // Only flip the fields that control new checkout. Everything else on the row
  // (currencies, capabilities, audit fields, history) is left untouched.
  const toDisable = legacyConfigs.filter(
    config => config.enabled || config.operationalStatus !== 'DISABLED'
  )

  if (toDisable.length === 0) {
    console.log(
      '[payment-provider-bootstrap] PayHere already disabled for new checkout; rows preserved',
      JSON.stringify({ preservedRows: legacyConfigs.length })
    )
    return
  }

  await prisma.paymentProviderConfig.updateMany({
    where: { id: { in: toDisable.map(config => config.id) } },
    data: {
      enabled: false,
      operationalStatus: 'DISABLED',
      updatedBy: 'system:payment-provider-bootstrap',
    },
  })

  console.log(
    '[payment-provider-bootstrap] disabled PayHere for new checkout; historical rows preserved',
    JSON.stringify({
      disabledRows: toDisable.length,
      preservedRows: legacyConfigs.length,
      markets: legacyConfigs.map(config => config.countryCode),
    })
  )
}

main()
  .catch(error => {
    console.error('[payment-provider-bootstrap] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })