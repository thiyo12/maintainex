import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'
import { postLedgerTransaction } from '@/lib/ledger'

const BOOST_TIERS = {
  basic: { durationDays: 7, lkr: 500, cad: 5 },
  premium: { durationDays: 14, lkr: 1200, cad: 12 },
  top: { durationDays: 30, lkr: 2500, cad: 25 },
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const body = await request.json()
    const { tier, paymentMethod = 'wallet' } = body

    if (!tier || !BOOST_TIERS[tier as keyof typeof BOOST_TIERS]) {
      return NextResponse.json({ error: 'Invalid tier. Choose: basic, premium, top' }, { status: 400 })
    }

    const listing = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (listing.postedBy !== session.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 })
    if (listing.status !== 'approved' && listing.status !== 'published') {
      return NextResponse.json({ error: 'Listing must be approved before boosting' }, { status: 400 })
    }

    const tierConfig = BOOST_TIERS[tier as keyof typeof BOOST_TIERS]
    const currency = listing.countryCode === 'CA' ? 'CAD' : 'LKR'
    const amount = listing.countryCode === 'CA' ? tierConfig.cad : tierConfig.lkr

    if (paymentMethod !== 'wallet') {
      return NextResponse.json({ error: 'External boost payments are not integrated yet', code: 'BOOST_PAYMENT_UNAVAILABLE' }, { status: 501 })
    }
    if (currency !== 'LKR') {
      return NextResponse.json({ error: 'Wallet payment is not available for this currency yet', code: 'WALLET_CURRENCY_UNAVAILABLE' }, { status: 501 })
    }

    const idempotencyKey = request.headers.get('idempotency-key') ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '')
    if (!idempotencyKey || idempotencyKey.length > 255) {
      return NextResponse.json({ error: 'Valid Idempotency-Key header is required' }, { status: 400 })
    }

    const wallet = await prisma.customerWallet.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })
    if (!wallet) return NextResponse.json({ error: 'Customer wallet not found' }, { status: 409 })

    const amountMinor = BigInt(amount) * 100n
    const operationKey = `property-boost-op:${id}:${session.id}:${idempotencyKey}`
    const ledgerKey = `property-boost-ledger:${id}:${session.id}:${idempotencyKey}`
    const payloadHash = `${id}:${session.id}:${tier}:${paymentMethod}:${amount}:${currency}`

    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, operationKey)

      const existing = await tx.idempotencyRecord.findUnique({ where: { idempotencyKey: operationKey } })
      if (existing?.status === 'COMPLETED' && existing.metadata) {
        const metadata = JSON.parse(existing.metadata)
        if (metadata.payloadHash !== payloadHash) throw new Error('IDEMPOTENCY_CONFLICT')
        const currentListing = await tx.realEstateListing.findUnique({ where: { id } })
        if (!currentListing) throw new Error('Listing not found')
        return { listing: currentListing, expiresAt: new Date(metadata.expiresAt), reused: true }
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + tierConfig.durationDays)

      await postLedgerTransaction({
        entries: [
          { accountId: wallet.id, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: amountMinor },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: amountMinor },
        ],
        referenceType: 'PROPERTY_BOOST',
        referenceId: id,
        idempotencyKey: ledgerKey,
        description: `Property boost ${tier} for listing ${id}`,
        createdBy: session.id,
      }, tx)

      // LEGACY_SHADOW_WRITE: compatibility only. WalletBalance + FinancialLedger
      // are canonical; this mirror is kept in the same transaction.
      const shadow = await tx.customerWallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (shadow.count !== 1) throw new Error('INSUFFICIENT_FUNDS')

      const shadowAfter = await tx.customerWallet.findUnique({
        where: { id: wallet.id },
        select: { balance: true },
      })
      if (!shadowAfter) throw new Error('Customer wallet not found')

      await tx.walletTransaction.create({
        data: {
          userId: session.id,
          walletType: 'CUSTOMER',
          type: 'DEBIT',
          amount,
          balanceBefore: shadowAfter.balance + amount,
          balanceAfter: shadowAfter.balance,
          reference: 'PROPERTY_BOOST',
          referenceType: 'PROPERTY_BOOST',
          referenceId: id,
        },
      })

      const boost = await tx.propertyBoost.create({
        data: { listingId: id, userId: session.id, tier, amount, currency, paymentMethod, status: 'active', expiresAt },
      })

      const updated = await tx.realEstateListing.update({
        where: { id },
        data: { boostTier: tier, boostExpiresAt: expiresAt, boostedAt: new Date() },
      })

      await tx.idempotencyRecord.create({
        data: {
          idempotencyKey: operationKey,
          operation: 'PROPERTY_BOOST',
          status: 'COMPLETED',
          metadata: JSON.stringify({ boostId: boost.id, payloadHash, expiresAt: expiresAt.toISOString() }),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })

      return { listing: updated, expiresAt, reused: false }
    })

    return NextResponse.json({
      success: true,
      idempotentReplay: outcome.reused,
      data: { listing: outcome.listing, boost: { tier, amount, currency, expiresAt: outcome.expiresAt } },
    })
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_FUNDS') return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    if (error?.message === 'IDEMPOTENCY_CONFLICT') return NextResponse.json({ error: 'Idempotency key conflict' }, { status: 409 })
    console.error('Error boosting property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to boost property' }, { status: 500 })
  }
}
