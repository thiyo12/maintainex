import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { evaluateEligibility } from '@/lib/matching/eligibility'
import { readStoredList } from '@/lib/db-utils'
import { haversineKm } from '@/lib/distance'

type DiscoveryInput = {
  templateJobId: string
  categoryId: string
  countryCode: 'LK' | 'CA'
  latitude: number | null
  longitude: number | null
  district: string | null
  radiusKm: number
}

/**
 * Read-only company suggestions for a catalogue service. This cannot grant a
 * booking or work authority; v2/jobs POST re-checks company eligibility,
 * capability, market, company owner and the confirmed service address.
 *
 * Browse location is a market-scoped hint, never proof of the customer's
 * future booking location. Do not return worker/owner accounts, exact provider
 * coordinates, or distance scores to the public results list.
 */
export async function findCompanyCandidatesForTemplate(
  input: DiscoveryInput,
  db: PrismaClient = prisma,
) {
  if (!input.templateJobId || !input.categoryId ||
      !['LK', 'CA'].includes(input.countryCode) ||
      !Number.isFinite(input.radiusKm) || input.radiusKm <= 0 || input.radiusKm > 100 ||
      (input.latitude == null) !== (input.longitude == null)) return []

  const coords = input.latitude !== null && input.longitude !== null
  const companies = await db.companyProfile.findMany({
    where: {
      countryCode: { equals: input.countryCode, mode: 'insensitive' },
      verificationStatus: 'VERIFIED',
      isVerified: true,
    },
    select: {
      id: true, companyName: true, logo: true, rating: true,
      completedProjects: true, staffCount: true, serviceAreas: true,
      latitude: true, longitude: true, serviceRadius: true,
    },
    orderBy: { rating: 'desc' },
    take: 40,
  })

  const available: Array<{
    id: string
    providerType: 'COMPANY'
    companyName: string
    logo: string | null
    rating: number
    completedJobs: number
    teamSize: number
    isVerified: true
    isOnline: false
    distance: null
    score: null
  }> = []

  for (const company of companies) {
    const declaredAreas = readStoredList(company.serviceAreas)
      .map(x => x.trim().toLowerCase()).filter(Boolean)
    const district = input.district?.trim().toLowerCase() || null
    const hasVerifiedRadius = coords &&
      company.latitude != null && company.longitude != null &&
      company.serviceRadius != null && company.serviceRadius > 0

    if (hasVerifiedRadius) {
      const distance = haversineKm(
        input.latitude!, input.longitude!, company.latitude!, company.longitude!,
      )
      if (!Number.isFinite(distance) ||
          distance > Math.min(input.radiusKm, company.serviceRadius!)) continue
    } else if (coords) {
      // Do not treat an unlocated company as nearby. A declared service area
      // is the minimum evidence when its office coordinates are unavailable.
      if (!district || !declaredAreas.some(area =>
        area === district || district.includes(area) || area.includes(district)
      )) continue
    } else if (input.countryCode === 'CA' && declaredAreas.length === 0) {
      // Without customer coordinates a radius-only Canadian provider cannot
      // establish municipal coverage. Never imply Canada-wide coverage.
      continue
    }

    const eligibility = await evaluateEligibility({
      providerType: 'COMPANY',
      providerId: company.id,
      job: {
        jobId: `catalogue-preview:${input.templateJobId}`,
        jobMode: 'QUOTE',
        urgency: 'NORMAL',
        categoryId: input.categoryId,
        templateJobId: input.templateJobId,
        countryCode: input.countryCode,
        latitude: input.latitude,
        longitude: input.longitude,
      },
      client: db,
    })
    if (!eligibility.eligible) continue

    available.push({
      id: company.id,
      providerType: 'COMPANY',
      companyName: company.companyName,
      logo: company.logo,
      rating: company.rating,
      completedJobs: company.completedProjects,
      teamSize: company.staffCount,
      isVerified: true,
      isOnline: false,
      distance: null,
      score: null,
    })
    if (available.length === 20) break
  }

  return available
}
