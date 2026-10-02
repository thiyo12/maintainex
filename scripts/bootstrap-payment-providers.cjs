'use strict'

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function boolEnv(name, fallback) {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  return value !== 'false'
}

async function main() {
  const existing = await prisma.paymentProviderConfig.findUnique({
    where: {
      countryCode_provider: {
        countryCode: 'LK',
        provider: 'PAYHERE',
      },
    },
  })

  // Respect any explicit operator configuration already stored in CRM.
  if (existing) {
    console.log('[payment-provider-bootstrap] LK/PAYHERE already configured; leaving unchanged')
    return
  }

  const checkoutConfigured = Boolean(
    process.env.PAYHERE_MERCHANT_ID &&
    process.env.PAYHERE_MERCHANT_SECRET
  )
  const merchantApiConfigured = Boolean(
    process.env.PAYHERE_APP_ID &&
    process.env.PAYHERE_APP_SECRET
  )
  const sandbox = boolEnv('PAYHERE_SANDBOX', true)
  const environment = sandbox ? 'SANDBOX' : 'LIVE'

  await prisma.paymentProviderConfig.create({
    data: {
      countryCode: 'LK',
      provider: 'PAYHERE',
      enabled: checkoutConfigured,
      environment,
      supportedCurrencies: JSON.stringify(['LKR']),
      paymentMethods: JSON.stringify(['PAYHERE']),
      capabilities: JSON.stringify({
        checkout: checkoutConfigured,
        authorize: false,
        capture: true,
        refund: merchantApiConfigured,
        partialRefund: false,
        webhooks: true,
        disputes: false,
        payouts: false,
        reconciliation: merchantApiConfigured,
      }),
      captureMode: 'CAPTURE',
      operationalStatus: checkoutConfigured ? 'ACTIVE' : 'DISABLED',
      priority: 100,
      updatedBy: 'system:payment-provider-bootstrap',
    },
  })

  console.log(
    '[payment-provider-bootstrap] created LK/PAYHERE operational config',
    JSON.stringify({
      enabled: checkoutConfigured,
      environment,
      refundConfigured: merchantApiConfigured,
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
