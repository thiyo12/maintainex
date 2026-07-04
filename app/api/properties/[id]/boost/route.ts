import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

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

    // Check wallet balance
    if (paymentMethod === 'wallet') {
      const wallet = await prisma.customerWallet.findUnique({
        where: { userId: session.id },
      })

      if (!wallet || wallet.balance < amount) {
        return NextResponse.json({
          error: `Insufficient balance. Required: ${currency} ${amount}, Available: ${currency} ${wallet?.balance || 0}`,
        }, { status: 400 })
      }

      // Deduct from wallet
      await prisma.customerWallet.update({
        where: { userId: session.id },
        data: { balance: { decrement: amount } },
      })

      // Create transaction record
      await prisma.walletTransaction.create({
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
    }

    // Calculate expiry
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + tierConfig.durationDays)

    // Create boost record
    await prisma.propertyBoost.create({
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

    // Update listing
    const updated = await prisma.realEstateListing.update({
      where: { id },
      data: {
        boostTier: tier,
        boostExpiresAt: expiresAt,
        boostedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        listing: updated,
        boost: { tier, amount, currency, expiresAt },
      },
    })
  } catch (error: any) {
    console.error('Error boosting property:', error)
    return NextResponse.json({ error: error?.message || 'Failed to boost property' }, { status: 500 })
  }
}
