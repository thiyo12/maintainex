import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, getCrmCountryCodes, guardCrmRequest } from '@/lib/crm/security'
import { CrewCommitGateError } from '@/lib/domain/company-crew-commit-gate'
import { inspectBlockedCrewSafetyEvidenceForCrmInsideTransaction } from '@/lib/domain/company-crew-safety-review-inventory'
import { secureConsole } from '@/lib/shared/observability/secure-console'

const HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
}
const CREW_EVENT_TYPES = new Set([
  'CREW_CONSUMED_PIN_SAFETY_HOLD',
  'CREW_WORKFORCE_PIN_SAFETY_HOLD',
  'WORKER_IDENTITY_MISMATCH',
])

const deny = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: HEADERS })

/**
 * Read-only, bounded CRM triage receipt for an existing HIGH crew safety hold.
 * Uses the canonical LIVE staff/session risk_events:read gate and country
 * scope. The risk event itself, NOT client-supplied crew/worker identity,
 * supplies a candidate. The locked domain helper verifies all evidence again.
 * No review decision, release, PIN, payment, arrival or work mutation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'risk_events:read', level: 'read', requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const { id } = await params
    if (typeof id !== 'string' || !id.trim() || id.length > 128 ||
        request.nextUrl.searchParams.size !== 0) {
      return deny('Invalid crew safety review request', 400)
    }
    const event = await prisma.marketplaceRiskEvent.findUnique({
      where: { id },
      select: {
        id: true, eventType: true, severity: true, reviewedAt: true,
        metadata: true, job: { select: { countryCode: true } },
      },
    })
    if (!event || event.severity !== 'HIGH' ||
        !CREW_EVENT_TYPES.has(event.eventType) || !event.job) {
      return deny('Crew safety risk event not found', 404)
    }
    if (!assertCrmCountryAllowed(guard.context, event.job.countryCode)) {
      return deny('Forbidden', 403)
    }
    if (event.reviewedAt !== null) {
      return deny('Crew safety event requires a separate manual review workflow', 409)
    }
    let metadata: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(event.metadata || '')
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return deny('Crew safety evidence scope is invalid', 409)
      }
      metadata = parsed as Record<string, unknown>
    } catch {
      return deny('Crew safety evidence scope is invalid', 409)
    }

    // These values come from stored risk metadata, never a client body.
    // They are not trusted until the SERIALIZABLE domain guard rechecks the
    // actual locked booking, crew epoch, held workers and exact risk event.
    const crewDispatchId = event.eventType === 'WORKER_IDENTITY_MISMATCH'
      ? metadata.crewId : metadata.crewDispatchId
    const companyId = metadata.companyId
    const expectedVersion = metadata.blockedVersion
    if (typeof crewDispatchId !== 'string' || !crewDispatchId.trim() ||
        crewDispatchId.length > 128 ||
        typeof companyId !== 'string' || !companyId.trim() ||
        companyId.length > 128 ||
        typeof expectedVersion !== 'number' ||
        !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      return deny('Crew safety evidence scope is invalid', 409)
    }

    const evidence = await prisma.$transaction(
      tx => inspectBlockedCrewSafetyEvidenceForCrmInsideTransaction(tx, {
        crewDispatchId, companyId, expectedVersion,
        riskEventId: event.id,
        allowedCountries: getCrmCountryCodes(guard.context),
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
    // Whitelist every public key; do not serialize raw stored risk metadata,
    // worker identities, old PINs, session/admin details or helper extras.
    return NextResponse.json({
      crewDispatchId: evidence.crewDispatchId,
      crewVersion: evidence.crewVersion,
      heldWorkerCount: evidence.heldWorkerCount,
      consumedPinClaimsPreserved: evidence.consumedPinClaimsPreserved,
      witnessRecordsPreserved: evidence.witnessRecordsPreserved,
      unreviewedHighRiskEvents: evidence.unreviewedHighRiskEvents,
      manualSafetyReviewRequired: true,
      independentPhysicalPresenceVerified: false,
      capacityReleaseEnabled: false,
      crewArrivalEnabled: false,
      workStartEnabled: false,
      paymentsEnabled: false,
    }, { headers: HEADERS })
  } catch (error) {
    if (error instanceof CrewCommitGateError) {
      return deny('Crew safety evidence needs independent support investigation',
        error.status === 404 ? 404 : 409)
    }
    secureConsole.error('CRM crew safety evidence inventory error:', error)
    return deny('Internal server error', 500)
  }
}
