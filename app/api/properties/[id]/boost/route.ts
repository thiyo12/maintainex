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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { tier, paymentMethod = 'wallet' } = body

    if (!tier || !BOOST_TIERS[tier as keyof typeof BOOST_TIERS]) {
      return NextResponse.json({ error: 'Invalid tier. Choose: basic, premium, top' }, { status: 400 })
    }

    const listing = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    if (listing.postedBy !== session.id) {
      return NextResponse.json({ error: 'Not your listing' }, { status: 403 })
    }

    if (listing.status !== 'approved' && listing.status !== 'published') {
      return NextResponse.json({ error: 'Listing must be approved before boosting' }, { status: 400 })
    }

    const tierConfig = BOOST_TIERS[tier as keyof typeof BOOST_TIERS]
    const currency = listing.countryCode === 'CA' ? 'CAD' : 'LKR'
    const amount = listing.countryCode === 'CA' ? tierConfig.cad : tierConfig.lkr

    if (paymentMethod !== 'wallet') {
      return NextResponse.json({
        error: 'External boost payments are not integrated yet',
        code: 'BOOST_PAYMENT_UNAVAILABLE',
      }, { status: 501 })
    }

    // The current customer wallet is LKR-only. Do not debit an LKR wallet for
    // a CAD-denominated boost until multi-currency wallet accounting exists.
    if (currency !== 'LKR') {
      return NextResponse.json({
        error: 'Wallet payment is not available for this currency yet',
        code: 'WALLET_CURRENCY_UNAVAILABLE',
      }, { status: 501 })
    }

    const idempotencyKey = request.headers.get('idempotency-key') ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '')
    if (!idempotencyKey || idempotencyKey.length > 255) {
      return NextResponse.json({ error: 'Valid Idempotency-Key header is required' }, { status: 400 })
    }

    const wallet = await prisma.customerWallet.findUnique({
      where: { userId: session.id },
      select: { id: true, balance: true },
    })
    if (!wallet) {
      return NextResponse.json({ error: 'Customer wallet not found' }, { status: 409 })
    }

    const amountMinor = BigInt(amount) * 100n
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + tierConfig.durationDays)

    const updated = await prisma.$transaction(async (tx) => {
      await postLedgerTransaction({
        entries: [
          { accountId: wallet.id, accountType: 'CUSTOMER_WALLET', entryType: 'DEBIT', amount: amountMinor },
          { accountId: 'platform', accountType: 'PLATFORM', entryType: 'CREDIT', amount: amountMinor },
        ],
        referenceType: 'PROPERTY_BOOST',
        referenceId: id,
        idempotencyKey: `property-boost:${id}:${session.id}:${idempotencyKey}`,
        description: `Property boost ${tier} for listing ${id}`,
        createdBy: session.id,
      }, tx)

      // LEGACY_SHADOW_WRITE: keep the existing customer-wallet API in sync while
      // WalletBalance is the canonical concurrency source. This shadow write is
      // inside the same transaction as the ledger movement and boost creation.
      const shadow = await tx.customerWallet.updateMany({
        where: { id: wallet.id, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (shadow.count !== 1) throw new Error('INSUFFICIENT_FUNDS')

      await tx.walletTransaction.create({
        data: {
          userId: session.id,
          walletType: 'CUSTOMER',
          type: 'DEBIT',
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance - amount,
          reference: 'PROPERTY_BOOST',
          referenceType: 'PROPERTY_BOOST',
          referenceId: id,
        },
      })

      await tx.propertyBoost.create({
        data: {
          listingId: id,
          userId: session.id,
          tier,
          amount,
          currency,
          paymentMethod,
          status: 'active',
          expiresAt,
        },
      })

      return tx.realEstateListing.update({
        where: { id },
        data: {
          boostTier: tier,
          boostExpiresAt: expiresAt,
          boostedAt: new Date(),
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        listing: updated,
        boost: { tier, amount, currency, expiresAt },
      },
    })
  } catch (error: any) {
    if (error?.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 })
    }
    console.error('Error boosting property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to boost property' }, { status: 500 })
  }
}
