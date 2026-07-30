import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function cuid(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function getMonday(weeksBack: number): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) - weeksBack * 7
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  console.log('🚀 seed-demo.ts — adding missing demo data (add-only, no deletes)')
  console.log('')

  // ────────────────────────────────────────
  // Fetch existing users by role
  // ────────────────────────────────────────

  const taskers = await prisma.user.findMany({ where: { role: 'TASKER' } })
  const companies = await prisma.user.findMany({ where: { role: 'COMPANY' } })
  const customers = await prisma.user.findMany({ where: { role: 'CUSTOMER' } })
  const allProviders = [...taskers, ...companies]

  console.log(`Found ${taskers.length} taskers, ${companies.length} companies, ${customers.length} customers`)
  console.log('')

  // ────────────────────────────────────────
  // 1. ProviderWallets
  // ────────────────────────────────────────

  console.log('💰 Creating ProviderWallets...')
  const existingProviderWallets = await prisma.providerWallet.findMany()
  const existingProviderUserIds = new Set(existingProviderWallets.map((w) => w.userId))
  let providerWalletCount = 0

  for (let i = 0; i < allProviders.length; i++) {
    const provider = allProviders[i]
    if (existingProviderUserIds.has(provider.id)) continue

    await prisma.providerWallet.create({
      data: {
        id: cuid(),
        userId: provider.id,
        availableBalance: randomBetween(5000, 200000),
        pendingBalance: randomBetween(0, 50000),
        isFrozen: i === 2, // one frozen wallet
      },
    })
    providerWalletCount++
  }
  console.log(`  ✓ ${providerWalletCount} provider wallets created (${existingProviderWallets.length} already existed)`)

  // ────────────────────────────────────────
  // 2. CustomerWallets
  // ────────────────────────────────────────

  console.log('💳 Creating CustomerWallets...')
  const existingCustomerWallets = await prisma.customerWallet.findMany()
  const existingCustomerUserIds = new Set(existingCustomerWallets.map((w) => w.userId))
  let customerWalletCount = 0

  for (const customer of customers) {
    if (existingCustomerUserIds.has(customer.id)) continue

    await prisma.customerWallet.create({
      data: {
        id: cuid(),
        userId: customer.id,
        balance: randomBetween(1000, 50000),
        isFrozen: false,
      },
    })
    customerWalletCount++
  }
  console.log(`  ✓ ${customerWalletCount} customer wallets created (${existingCustomerWallets.length} already existed)`)

  // ────────────────────────────────────────
  // 3. IdentityDocuments / KYC
  // ────────────────────────────────────────

  console.log('🪪 Creating IdentityDocuments...')
  const existingDocCount = await prisma.identityDocument.count()
  let docCount = 0

  if (existingDocCount === 0) {
    const docTypes = ['PASSPORT', 'NATIONAL_ID', 'DRIVING_LICENSE']
    const statuses = [
      ...Array(8).fill('APPROVED'),
      ...Array(5).fill('PENDING'),
      ...Array(2).fill('REJECTED'),
    ] as string[]

    const kycCandidates = [...taskers.slice(0, 8), ...companies.slice(0, 3), ...customers.slice(0, 4)]

    for (let i = 0; i < 15; i++) {
      const user = kycCandidates[i % kycCandidates.length]
      const status = statuses[i]
      const docType = docTypes[i % docTypes.length]
      const side = i % 2 === 0 ? 'FRONT' : 'BACK'

      await prisma.identityDocument.create({
        data: {
          id: cuid(),
          userId: user.id,
          docType,
          side,
          imageUrl: `https://example.com/docs/id-${String(i + 1).padStart(3, '0')}.jpg`,
          status,
          reviewNote:
            status === 'APPROVED'
              ? 'Document verified successfully.'
              : status === 'REJECTED'
                ? 'Document expired or image unclear. Please resubmit.'
                : null,
          reviewedBy: status !== 'PENDING' ? 'system-admin' : null,
          reviewedAt: status !== 'PENDING' ? daysAgo(randomBetween(1, 30)) : null,
        },
      })
      docCount++
    }
  } else {
    console.log(`  ℹ ${existingDocCount} identity documents already exist — skipping`)
  }
  console.log(`  ✓ ${docCount} identity documents created`)

  // ────────────────────────────────────────
  // 4. WeeklySettlements
  // ────────────────────────────────────────

  console.log('📊 Creating WeeklySettlements...')
  const existingSettlementCount = await prisma.weeklySettlement.count()
  let settlementCount = 0

  if (existingSettlementCount === 0) {
    const settlementProviders = [...taskers.slice(0, 5), ...companies.slice(0, 3)]
    const settlementStatuses = ['PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PENDING', 'PENDING', 'OVERDUE']

    for (let week = 7; week >= 0; week--) {
      const weekStart = getMonday(week)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const providerIdx = (7 - week) % settlementProviders.length
      const provider = settlementProviders[providerIdx]
      const totalEarnings = randomBetween(15000, 200000)
      const commissionOwed = Math.round(totalEarnings * 0.1)
      const status = settlementStatuses[7 - week]

      await prisma.weeklySettlement.create({
        data: {
          id: cuid(),
          providerId: provider.id,
          providerType: provider.role === 'TASKER' ? 'TASKER' : 'COMPANY',
          weekStart,
          weekEnd,
          totalEarnings,
          commissionRate: 10.0,
          commissionOwed,
          commissionPaid: status === 'PAID',
          paidAt: status === 'PAID' ? new Date(weekEnd.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
          dueAt: new Date(weekEnd.getTime() + 7 * 24 * 60 * 60 * 1000),
          status,
        },
      })
      settlementCount++
    }
  } else {
    console.log(`  ℹ ${existingSettlementCount} weekly settlements already exist — skipping`)
  }
  console.log(`  ✓ ${settlementCount} weekly settlements created`)

  // ────────────────────────────────────────
  // 5. WalletTransactions
  // ────────────────────────────────────────

  console.log('🔄 Creating WalletTransactions...')
  const existingTxCount = await prisma.walletTransaction.count()
  let txCount = 0

  if (existingTxCount === 0) {
    const referenceTypes = ['JOB_PAYMENT', 'COMMISSION', 'PAYOUT', 'ESCROW_RELEASE', 'SERVICE_FEE', 'WITHDRAWAL']

    for (let i = 0; i < 30; i++) {
      const isProvider = i < 20
      const userPool = isProvider ? allProviders : customers
      const user = userPool[i % userPool.length]
      const walletType = isProvider ? 'PROVIDER' : 'CUSTOMER'
      const type = i % 3 === 0 ? 'DEBIT' : 'CREDIT'
      const amount = randomBetween(500, 25000)
      const balanceBefore = randomBetween(10000, 100000)
      const balanceAfter = type === 'CREDIT' ? balanceBefore + amount : Math.max(0, balanceBefore - amount)

      await prisma.walletTransaction.create({
        data: {
          id: cuid(),
          userId: user.id,
          walletType,
          type,
          amount,
          balanceBefore,
          balanceAfter,
          reference: `TXN-${String(randomBetween(100000, 999999))}`,
          referenceType: referenceTypes[i % referenceTypes.length],
          status: i === 29 ? 'PENDING' : 'COMPLETED',
        },
      })
      txCount++
    }
  } else {
    console.log(`  ℹ ${existingTxCount} wallet transactions already exist — skipping`)
  }
  console.log(`  ✓ ${txCount} wallet transactions created`)

  // ────────────────────────────────────────
  // 6. CommissionSettlements
  // ────────────────────────────────────────

  console.log('🏦 Creating CommissionSettlements...')
  const existingCommissionCount = await prisma.commissionSettlement.count()
  let commissionCount = 0

  if (existingCommissionCount === 0) {
    const marketplaceJobs = await prisma.marketplaceJob.findMany()
    const statuses = ['SETTLED', 'SETTLED', 'SETTLED', 'SETTLED', 'SETTLED', 'PENDING', 'PENDING', 'PENDING', 'SETTLED', 'SETTLED']

    for (let i = 0; i < 10; i++) {
      const job = marketplaceJobs[i % marketplaceJobs.length]
      const provider = allProviders[i % allProviders.length]
      const customer = customers[i % customers.length]
      const jobAmount = randomBetween(3000, 50000)
      const commissionAmount = Math.round(jobAmount * 0.1)
      const status = statuses[i]

      await prisma.commissionSettlement.create({
        data: {
          id: cuid(),
          jobId: job.id,
          escrowId: `escrow-${cuid()}`,
          providerId: provider.id,
          customerId: customer.id,
          jobAmount: BigInt(jobAmount),
          commissionRate: 10.0,
          commissionAmount: BigInt(commissionAmount),
          status,
          settledAt: status === 'SETTLED' ? daysAgo(randomBetween(1, 30)) : null,
        },
      })
      commissionCount++
    }
  } else {
    console.log(`  ℹ ${existingCommissionCount} commission settlements already exist — skipping`)
  }
  console.log(`  ✓ ${commissionCount} commission settlements created`)

  // ────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────

  console.log('')
  console.log('✅ seed-demo.ts completed!')
  console.log('')
  console.log('Summary:')
  console.log(`  ProviderWallets:     ${providerWalletCount} created`)
  console.log(`  CustomerWallets:     ${customerWalletCount} created`)
  console.log(`  IdentityDocuments:   ${docCount} created`)
  console.log(`  WeeklySettlements:   ${settlementCount} created`)
  console.log(`  WalletTransactions:  ${txCount} created`)
  console.log(`  CommissionSettlements: ${commissionCount} created`)
  console.log('')
  console.log('No existing data was deleted.')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
