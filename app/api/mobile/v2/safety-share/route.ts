import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, ipKey } from '@/lib/rate-limit/middleware'
import { hashTrustedContactToken, isValidTrustedContactToken } from '@/lib/safety/trusted-contact-share'

const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store, private, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, {
    policyName: 'PRICING_QUERY',
    keyPrefix: 'trusted_contact_status_lookup',
    identifier: ipKey(request),
  })
  if (!rateLimit.allowed) return rateLimit.response!

  const body = await request.json().catch(() => null)
  const token: unknown = body?.token
  if (!isValidTrustedContactToken(token)) {
    return NextResponse.json({ error: 'Share link is invalid or expired' }, { status: 404, headers: PRIVATE_HEADERS })
  }
  const now = new Date()
  let share
  try {
    share = await prisma.trustedContactShare.findUnique({
      where: { tokenHash: hashTrustedContactToken(token) },
      select: {
        revokedAt: true,
        expiresAt: true,
        job: { select: { status: true, countryCode: true, preferredDate: true } },
      },
    })
  } catch {
    return NextResponse.json({ error: 'Share status is temporarily unavailable' }, { status: 503, headers: PRIVATE_HEADERS })
  }
  if (!share || share.revokedAt || share.expiresAt <= now) {
    return NextResponse.json({ error: 'Share link is invalid or expired' }, { status: 404, headers: PRIVATE_HEADERS })
  }
  return NextResponse.json({
    status: share.job.status,
    market: share.job.countryCode,
    scheduledDate: share.job.preferredDate,
    expiresAt: share.expiresAt,
    note: 'This link shares booking status only. It is not monitored for emergencies.',
  }, { headers: PRIVATE_HEADERS })
}
