'use strict'

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

/**
 * PayHere is historical/read-only for MaintainEX.
 *
 * Preserve existing provider rows and all historical payment data, but force
 * PayHere provider configuration out of new-checkout service on every boot.
 * PayPal remains operator-governed per market and is never auto-created here.
 */
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

  const toDisable = legacyConfigs.filter(
    config => config.enabled || config.operationalStatus !== 'DISABLED'
  )

  if (toDisable.length > 0) {
    await prisma.paymentProviderConfig.updateMany({
      where: { id: { in: toDisable.map(config => config.id) } },
      data: {
        enabled: false,
        operationalStatus: 'DISABLED',
        updatedBy: 'system:payment-provider-bootstrap',
      },
    })
  }

  console.log(
    '[payment-provider-bootstrap] PayHere kept legacy/read-only',
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
