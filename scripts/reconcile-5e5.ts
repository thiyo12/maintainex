import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== PHASE 5E.5 REAL WALLET RECONCILIATION ===\n')

  // 1. Get all 73 real WalletBalance rows
  const realWallets = await prisma.$queryRawUnsafe<Array<{
    walletId: string; walletType: string; balance: number
  }>>(
    `SELECT "walletId", "walletType", "balance" FROM "WalletBalance"
     WHERE "walletId" NOT LIKE 'test%' AND "walletId" NOT LIKE 'concurrent%'
     AND "walletId" NOT LIKE 'balanced%' AND "walletId" NOT LIKE 'immutable%'
     AND "walletId" NOT LIKE 'wb-test%' AND "walletId" NOT LIKE 'wallet-underflow%'
     AND "walletId" NOT LIKE 'customer:test%' AND "walletId" NOT LIKE 'provider:test%'
     ORDER BY "walletType", "walletId"`
  )

  // 2. For each real wallet, find the matching userId via CustomerWallet or ProviderWallet
  // Then reconstruct balance from FinancialLedger using userId as accountId
  let matched = 0
  let mismatches = 0
  let providerMatched = 0
  let customerMatched = 0

  for (const wallet of realWallets) {
    // Find the userId that maps this walletId to its FinancialLedger accountId
    let userId: string | null = null

    if (wallet.walletType === 'CUSTOMER') {
      const rows = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        'SELECT "userId" FROM "CustomerWallet" WHERE id = $1', wallet.walletId
      )
      if (rows.length > 0) userId = rows[0].userId
    } else {
      const rows = await prisma.$queryRawUnsafe<Array<{ userId: string }>>(
        'SELECT "userId" FROM "ProviderWallet" WHERE id = $1', wallet.walletId
      )
      if (rows.length > 0) userId = rows[0].userId
    }

    if (!userId) {
      console.log(`  NO USER MAPPING: ${wallet.walletId} (${wallet.walletType})`)
      mismatches++
      continue
    }

    // Reconstruct balance: opening balance + subsequent credits - subsequent debits
    const ledgerAgg = await prisma.$queryRawUnsafe<Array<{ credits: number; debits: number }>>(
      `SELECT
        COALESCE(SUM(CASE WHEN "entryType" = 'CREDIT' THEN "amount" ELSE 0 END), 0) as credits,
        COALESCE(SUM(CASE WHEN "entryType" = 'DEBIT' THEN "amount" ELSE 0 END), 0) as debits
       FROM "FinancialLedger"
       WHERE "accountId" = $1 AND "createdBy" != 'test' AND "createdBy" != 'test-5c1' AND "createdBy" != 'test-phase5c'`,
      userId
    )

    const credits = Number(ledgerAgg[0].credits)
    const debits = Number(ledgerAgg[0].debits)
    const reconstructed = credits - debits

    if (reconstructed === wallet.balance) {
      matched++
      if (wallet.walletType === 'PROVIDER') providerMatched++
      else customerMatched++
    } else {
      mismatches++
      console.log(`  MISMATCH: ${wallet.walletId} (${wallet.walletType}) userId=${userId}: WalletBalance=${wallet.balance} Ledger(reconstructed)=${reconstructed} (credits=${credits} debits=${debits})`)
    }
  }

  console.log(`\n=== RECONCILIATION RESULTS ===`)
  console.log(`Total real wallets: ${realWallets.length}`)
  console.log(`Matched: ${matched}`)
  console.log(`  Provider: ${providerMatched}`)
  console.log(`  Customer: ${customerMatched}`)
  console.log(`Mismatches: ${mismatches}`)

  // 3. Double-entry verification for system-backfill
  console.log('\n=== DOUBLE-ENTRY VERIFICATION (system-backfill) ===')
  const backfillAgg = await prisma.$queryRawUnsafe<Array<{ entryType: string; count: number; total: number }>>(
    `SELECT "entryType", COUNT(*) as count, SUM("amount") as total
     FROM "FinancialLedger" WHERE "createdBy" = 'system-backfill' GROUP BY "entryType"`
  )
  for (const row of backfillAgg) {
    console.log(`  ${row.entryType}: ${row.count} entries, total=${row.total}`)
  }
  const backfillCredits = backfillAgg.find(r => r.entryType === 'CREDIT')
  const backfillDebits = backfillAgg.find(r => r.entryType === 'DEBIT')
  const backfillDiff = backfillCredits && backfillDebits ? Number(backfillCredits.total) - Number(backfillDebits.total) : 'N/A'
  console.log(`  Difference (credits - debits): ${backfillDiff}`)

  // 4. Total legitimate ledger reconciliation
  console.log('\n=== TOTAL LEGITIMATE LEDGER RECONCILIATION ===')
  const allLegitAgg = await prisma.$queryRawUnsafe<Array<{ entryType: string; total: number }>>(
    `SELECT "entryType", SUM("amount") as total
     FROM "FinancialLedger"
     WHERE "createdBy" = 'system-backfill'
     GROUP BY "entryType"`
  )
  const totalCredits = Number(allLegitAgg.find(r => r.entryType === 'CREDIT')?.total || 0)
  const totalDebits = Number(allLegitAgg.find(r => r.entryType === 'DEBIT')?.total || 0)
  console.log(`  Total CREDITS: ${totalCredits}`)
  console.log(`  Total DEBITS: ${totalDebits}`)
  console.log(`  Difference: ${totalCredits - totalDebits}`)

  // 5. Platform account balance
  console.log('\n=== PLATFORM ACCOUNT BALANCE ===')
  const platformAgg = await prisma.$queryRawUnsafe<Array<{ entryType: string; total: number }>>(
    `SELECT "entryType", SUM("amount") as total
     FROM "FinancialLedger" WHERE "accountId" = 'platform' AND "createdBy" = 'system-backfill'
     GROUP BY "entryType"`
  )
  const platformCredits = Number(platformAgg.find(r => r.entryType === 'CREDIT')?.total || 0)
  const platformDebits = Number(platformAgg.find(r => r.entryType === 'DEBIT')?.total || 0)
  console.log(`  Platform CREDITS (opening): ${platformCredits}`)
  console.log(`  Platform DEBITS (opening): ${platformDebits}`)
  console.log(`  Platform net: ${platformDebits - platformCredits}`)

  // 6. Classification summary
  console.log('\n=== ENTRY CLASSIFICATION ===')
  const classAgg = await prisma.$queryRawUnsafe<Array<{ createdBy: string; count: number }>>(
    `SELECT "createdBy", COUNT(*) as count FROM "FinancialLedger" GROUP BY "createdBy" ORDER BY "createdBy"`
  )
  for (const row of classAgg) {
    const classification =
      row.createdBy === 'system-backfill' ? 'LEGITIMATE_BACKFILL' :
      row.createdBy === 'test' ? 'TEST_POLLUTION' :
      row.createdBy === 'test-5c1' ? 'TEST_POLLUTION' :
      row.createdBy === 'test-phase5c' ? 'TEST_POLLUTION' :
      row.createdBy === 'system' ? 'TEST_POLLUTION (system entries are all test)' :
      'UNKNOWN'
    console.log(`  ${row.createdBy}: ${row.count} entries [${classification}]`)
  }

  // 7. Idempotency records
  console.log('\n=== IDEMPOTENCY RECORDS ===')
  const idemCount = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    'SELECT COUNT(*) as count FROM "IdempotencyRecord"'
  )
  const idemKeys = await prisma.$queryRawUnsafe<Array<{ idempotencyKey: string }>>(
    `SELECT "idempotencyKey" FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE 'opening-balance:%'`
  )
  console.log(`  Total idempotency records: ${Number(idemCount[0].count)}`)
  console.log(`  Opening balance idempotency keys: ${idemKeys.length}`)
  if (idemKeys.length > 0) {
    console.log(`  Sample: ${idemKeys[0].idempotencyKey}`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
