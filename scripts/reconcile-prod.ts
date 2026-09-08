import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEST_PREFIXES = ['test', 'test-5c1', 'test-phase5c']
const TEST_ACCOUNT_PATTERNS = [
  /^test-/,
  /^concurrent-/,
  /^balanced-/,
  /^immutable-/,
  /^test:/,
  /^customer:test/,
  /^escrow:test/,
  /^provider:test/,
]
const TEST_WALLET_PATTERNS = [
  /^test/,
  /^concurrent-/,
  /^balanced-/,
  /^immutable-/,
  /^wb-test/,
  /^wallet-underflow/,
  /^customer:test/,
  /^provider:test/,
]

function isTestAccount(accountId: string): boolean {
  return TEST_ACCOUNT_PATTERNS.some(p => p.test(accountId))
}

function isTestWallet(walletId: string): boolean {
  return TEST_WALLET_PATTERNS.some(p => p.test(walletId))
}

async function main() {
  console.log('=== PRODUCTION RECONCILIATION (excluding test entries) ===\n')

  const totalLedger = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM "FinancialLedger"'
  )
  console.log(`Total FinancialLedger entries: ${Number(totalLedger[0].count)}`)

  const legitimateSystem = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "createdBy" = 'system'`
  )
  const systemTestEntries = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "createdBy" = 'system' AND ("accountId" LIKE 'test-%' OR "accountId" LIKE 'customer:test-%' OR "accountId" LIKE 'escrow:test-%' OR "accountId" LIKE 'provider:test-%' OR "accountId" LIKE 'test:%')`
  )
  const backfill = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "createdBy" = 'system-backfill'`
  )
  const testPollution = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "FinancialLedger" WHERE "createdBy" IN ('test','test-5c1','test-phase5c')`
  )

  const legitSystem = Number(legitimateSystem[0].count) - Number(systemTestEntries[0].count)
  const legitBackfill = Number(backfill[0].count)
  const totalLegit = legitSystem + legitBackfill
  const totalPollution = Number(testPollution[0].count) + Number(systemTestEntries[0].count)

  console.log(`  Legitimate system entries: ${legitSystem}`)
  console.log(`  Legitimate backfill entries: ${legitBackfill}`)
  console.log(`  System-created test pollution: ${Number(systemTestEntries[0].count)}`)
  console.log(`  Direct test pollution: ${Number(testPollution[0].count)}`)
  console.log(`  Total legitimate: ${totalLegit}`)
  console.log(`  Total pollution: ${totalPollution}`)

  const realWallets = await prisma.$queryRawUnsafe<Array<{ walletId: string; walletType: string; balance: number }>>(
    `SELECT "walletId", "walletType", "balance" FROM "WalletBalance" ORDER BY "walletId"`
  )

  let mismatches = 0
  let realTouched = 0
  let syntheticOnly = 0

  for (const wallet of realWallets) {
    if (isTestWallet(wallet.walletId)) {
      syntheticOnly++
      continue
    }

    const ledgerBalance = await prisma.$queryRawUnsafe<Array<{ credits: number; debits: number }>>(
      `SELECT
        COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN "amount" ELSE 0 END), 0) as credits,
        COALESCE(SUM(CASE WHEN "entryType" = 'DEBIT' THEN "amount" ELSE 0 END), 0) as debits
       FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "createdBy" NOT IN ('test','test-5c1','test-phase5c')
         AND NOT ("createdBy" = 'system' AND ("accountId" LIKE 'test-%' OR "accountId" LIKE 'customer:test-%' OR "accountId" LIKE 'escrow:test-%' OR "accountId" LIKE 'provider:test-%' OR "accountId" LIKE 'test:%'))`,
      wallet.walletId
    )

    const ledgerCreds = Number(ledgerBalance[0].credits)
    const ledgerDebits = Number(ledgerBalance[0].debits)
    const ledgerNet = ledgerCreds - ledgerDebits

    if (ledgerNet !== wallet.balance) {
      mismatches++
      console.log(`  MISMATCH: ${wallet.walletId} (${wallet.walletType}): WalletBalance=${wallet.balance} Ledger(reconciled)=${ledgerNet}`)
    }
    realTouched++
  }

  console.log(`\n=== RECONCILIATION RESULTS ===`)
  console.log(`Real wallets checked: ${realTouched}`)
  console.log(`Synthetic wallets (excluded): ${syntheticOnly}`)
  console.log(`Mismatches (real wallets): ${mismatches}`)

  const totalWb = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM "WalletBalance"'
  )
  console.log(`\nTotal WalletBalance rows: ${Number(totalWb[0].count)}`)
  console.log(`  Synthetic: ${syntheticOnly}`)
  console.log(`  Real: ${realTouched}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
