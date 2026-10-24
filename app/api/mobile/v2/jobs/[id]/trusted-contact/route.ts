import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import {
  createTrustedContactToken,
  hashTrustedContactToken,
  TRUSTED_CONTACT_CONSENT_VERSION,
  trustedContactExpiry,
} from '@/lib/safety/trusted-contact-share'

const SHAREABLE_STATES = new Set([
  'QUOTE_ACCEPTED', 'ESCROW_DEPOSITED', 'IN_PROGRESS', 'COMPLETION_PENDING',
  'COMPLETED', 'DISPUTED', 'CANCELLED',
])

async function canAccessSafetyCentre(jobId: string, userId: string) {
  const job = await prisma.marketplaceJob.findUnique({
    where: { id: jobId },
    select: { id: true, customerId: true, countryCode: true, status: true, preferredDate: true },
  })
  if (!job || !SHAREABLE_STATES.has(job.status)) return null
  if (job.customerId === userId) return job

  const quote = await prisma.jobQuote.findFirst({
    where: { jobId, status: 'ACCEPTED' },
    select: { providerId: true, providerType: true },
  })
  if (!quote) return null
  if (quote.providerType === 'INDIVIDUAL' && quote.providerId === userId) return job
  if (quote.providerType !== 'COMPANY') return null

  const [member, assignment] = await Promise.all([
    prisma.teamMember.findFirst({
      where: { companyId: quote.providerId, userId, status: 'ACTIVE' }, select: { id: true },
    }),
    prisma.companyJobAssignment.findFirst({
      where: { companyId: quote.providerId, jobId, workerUserId: userId,
        status: { in: ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] } }, select: { id: true },
    }),
  ])
  return member && assignment ? job : null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = assertNotSuspended(user)
  if (blocked) return blocked
  const { id } = await params
  const job = await canAccessSafetyCentre(id, user.id)
  if (!job) return NextResponse.json({ error: 'Not an authorized job participant' }, { status: 404 })
  const shares = await prisma.trustedContactShare.findMany({
    where: { jobId: id, actorUserId: user.id },
    select: { id: true, consentedAt: true, expiresAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 10,
  })
  return NextResponse.json({ shares }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = assertNotSuspended(user)
  if (blocked) return blocked
  const { id } = await params
  const job = await canAccessSafetyCentre(id, user.id)
  if (!job) return NextResponse.json({ error: 'Not an authorized job participant' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (body?.consent !== true) {
    return NextResponse.json({ error: 'Explicit consent is required before creating a trusted-contact link' }, { status: 400 })
  }
  const expiresAt = trustedContactExpiry(body?.expiresInHours)
  if (!expiresAt) return NextResponse.json({ error: 'Expiry must be between 1 and 24 hours' }, { status: 400 })
  let shareOrigin: string
  try {
    const base = new URL(process.env.EXPO_PUBLIC_API_URL || 'https://maintainex.lk')
    if (base.protocol !== 'https:' || !['maintainex.lk', 'www.maintainex.lk'].includes(base.hostname)) {
      throw new Error('Invalid host')
    }
    shareOrigin = base.origin
  } catch {
    return NextResponse.json({ error: 'Trusted contact sharing is not configured' }, { status: 503 })
  }

  const now = new Date()
  const token = createTrustedContactToken()
  try {
    const share = await prisma.$transaction(async tx => {
      // Serialize competing share requests for the same actor and booking.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}), hashtext(${user.id}))`
      const active = await tx.trustedContactShare.findFirst({
        where: { jobId: id, actorUserId: user.id, revokedAt: null, expiresAt: { gt: now } },
        select: { id: true },
      })
      if (active) throw new Error('ACTIVE_SHARE_EXISTS')
      return tx.trustedContactShare.create({ data: {
        jobId: id,
        actorUserId: user.id,
        tokenHash: hashTrustedContactToken(token),
        consentedAt: now,
        consentVersion: TRUSTED_CONTACT_CONSENT_VERSION,
        expiresAt,
      }, select: { id: true, expiresAt: true, consentedAt: true } })
    }, { isolationLevel: 'Serializable' })
    return NextResponse.json({
      share,
      url: `${shareOrigin}/safety-share#${token}`,
      sharedFields: ['booking status', 'market', 'scheduled date'],
      excludedFields: ['street address', 'account details', 'payment details', 'incident details'],
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVE_SHARE_EXISTS') {
      return NextResponse.json({ error: 'Revoke the current active link before creating another' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not create trusted-contact link' }, { status: 500 })
  }
}
