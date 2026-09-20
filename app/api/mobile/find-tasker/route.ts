import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { matchTaskerCandidates, resolveJobCategoryKeys } from '@/lib/job-matching'
import { getSetting } from '@/lib/settings'
import { isSyntheticCertAccount } from '@/lib/test-cert'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const latParam = searchParams.get('latitude')
    const lngParam = searchParams.get('longitude')
    const maxDistParam = searchParams.get('maxDistance')
    const countryParam = searchParams.get('country')

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const templateJob = await prisma.templateJob.findUnique({
      where: { id: jobId },
      include: { category: { select: { id: true, name: true, slug: true } } },
    })

    if (!templateJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const { keys } = await resolveJobCategoryKeys(templateJob.category.id)

    const lat = latParam ? parseFloat(latParam) : null
    const lng = lngParam ? parseFloat(lngParam) : null
    const radiusKm = maxDistParam ? parseFloat(maxDistParam) : await getSetting('matching.radius_km', 50)

    const candidates = await matchTaskerCandidates({ matchKeys: keys, lat, lng, radiusKm })

    const countryCode = (countryParam || user.countryCode || 'LK').toUpperCase()
    const categoryTerms = [
      templateJob.category.id,
      templateJob.category.slug || '',
      templateJob.category.name || '',
      ...keys,
    ].map((value) => String(value).toLowerCase()).filter(Boolean)

    const companyProfiles = await prisma.companyProfile.findMany({
      where: {
        countryCode,
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
      include: {
        specialties: true,
        teamMembers: {
          where: { status: 'ACTIVE' },
          select: { id: true, isOnline: true, rating: true, completedJobs: true, skills: true },
        },
      },
      take: 80,
    })

    const radians = (degrees: number) => degrees * Math.PI / 180
    const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
      const earthKm = 6371
      const dLat = radians(bLat - aLat)
      const dLng = radians(bLng - aLng)
      const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(radians(aLat)) * Math.cos(radians(bLat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
      return earthKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
    }

    const companies = companyProfiles
      .filter((company) => {
        const specialtyMatch = company.specialties.some((specialty) =>
          specialty.jobId === templateJob.id || specialty.categoryId === templateJob.category.id
        )
        const serviceText = String(company.services || '').toLowerCase()
        const servicesMatch = categoryTerms.some((term) => term.length >= 3 && serviceText.includes(term))
        return specialtyMatch || servicesMatch
      })
      .map((company) => {
        const distance =
          lat != null && lng != null && company.latitude != null && company.longitude != null
            ? distanceKm(lat, lng, company.latitude, company.longitude)
            : null
        const onlineWorkers = company.teamMembers.filter((member) => member.isOnline).length
        const activeWorkers = company.teamMembers.length
        const score =
          60 +
          Math.min(Number(company.rating || 0) * 5, 25) +
          Math.min(Number(company.completedProjects || 0) / 20, 8) +
          Math.min(onlineWorkers * 2, 7)

        return {
          id: company.id,
          userId: company.userId,
          name: company.companyName,
          companyName: company.companyName,
          bio: company.description || '',
          rating: company.rating,
          completedJobs: company.completedProjects,
          isVerified: company.isVerified,
          isOnline: onlineWorkers > 0,
          availableNow: onlineWorkers > 0,
          profileImage: company.logo,
          latitude: company.latitude,
          longitude: company.longitude,
          distance,
          score: Math.round(score),
          skills: [],
          hourlyRate: null,
          fixedRate: 0,
          experienceYears: 0,
          providerType: 'COMPANY',
          teamSize: activeWorkers,
          onlineWorkers,
        }
      })
      .filter((company) => company.distance == null || company.distance <= radiusKm)

    const taskerResults = candidates.map((c) => ({
      id: c.profile.id,
      userId: c.profile.userId,
      name: c.profile.user.name,
      bio: c.profile.bio || '',
      rating: c.profile.rating,
      completedJobs: c.profile.completedJobs,
      isVerified: c.profile.isVerified,
      isOnline: c.profile.isOnline,
      profileImage: c.profile.profileImage,
      latitude: c.profile.latitude,
      longitude: c.profile.longitude,
      distance: c.distanceKm,
      score: Math.round(c.score * 100),
      skills: c.skills,
      hourlyRate: c.profile.hourlyRate,
      fixedRate: 0,
      experienceYears: 0,
      providerType: 'INDIVIDUAL',
    }))

    // Certification accounts are allowed to see other synthetic certification
    // Taskers immediately so the full customer -> provider flow can be tested
    // without weakening production verification rules. Exact TaskerSkill match
    // is still required, and this path is impossible unless ALLOW_TEST_OTP=true.
    const certificationTaskers: any[] = []
    if (isSyntheticCertAccount(user)) {
      const certProfiles = await prisma.taskerProfile.findMany({
        where: {
          countryCode,
          taskerSkills: { some: { jobId: templateJob.id } },
          user: { isSuspended: false, isBanned: false, isActive: true },
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        take: 30,
      })

      for (const profile of certProfiles) {
        if (!isSyntheticCertAccount(profile.user)) continue
        const duplicate = taskerResults.some((tasker) => tasker.id === profile.id)
        if (duplicate) continue

        const distance =
          lat != null && lng != null && profile.latitude != null && profile.longitude != null
            ? distanceKm(lat, lng, profile.latitude, profile.longitude)
            : null
        if (distance != null && distance > radiusKm) continue

        certificationTaskers.push({
          id: profile.id,
          userId: profile.userId,
          name: profile.user.name,
          bio: profile.bio || '',
          rating: profile.rating,
          completedJobs: profile.completedJobs,
          isVerified: profile.isVerified,
          isOnline: profile.isOnline,
          availableNow: true,
          profileImage: profile.profileImage,
          latitude: profile.latitude,
          longitude: profile.longitude,
          distance,
          score: 55,
          skills: [],
          hourlyRate: profile.hourlyRate,
          fixedRate: 0,
          experienceYears: 0,
          providerType: 'INDIVIDUAL',
          isCertificationTest: true,
        })
      }
    }

    return NextResponse.json(
      [...taskerResults, ...certificationTaskers, ...companies].sort((a, b) => {
        const aDistance = a.distance == null ? Number.POSITIVE_INFINITY : a.distance
        const bDistance = b.distance == null ? Number.POSITIVE_INFINITY : b.distance
        if (Math.abs(Number(b.score || 0) - Number(a.score || 0)) > 8) return Number(b.score || 0) - Number(a.score || 0)
        return aDistance - bDistance
      })
    )
  } catch (error) {
    console.error('Find tasker error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}