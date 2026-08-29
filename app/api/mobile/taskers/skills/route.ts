import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'

const COMPANY_ONLY = ['landscaping', 'moving-truck', 'roofing-large']

// GET: current tasker's service selection grouped by category,
// merged with the full active template-job catalog
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const tasker = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!tasker) return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })

    const [categories, existing] = await Promise.all([
      prisma.jobCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          jobs: {
            where: { isActive: true },
            orderBy: { priceMin: 'asc' },
          },
        },
      }),
      prisma.taskerSkill.findMany({
        where: { taskerId: tasker.id },
        select: {
          jobId: true,
          hourlyRate: true,
          fixedRate: true,
          experienceYears: true,
          experienceLevel: true,
        },
      }),
    ])

    const selected = new Map(existing.map(s => [s.jobId, s]))

    const categoriesOut = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      iconName: cat.iconName,
      colorHex: cat.colorHex,
      jobs: cat.jobs
        .filter(j => !j.isCompanyOnly)
        .map(j => {
          const sel = selected.get(j.id)
          return {
            id: j.id,
            name: j.name,
            priceMin: j.priceMin,
            priceMax: j.priceMax,
            currency: j.currency,
            selected: !!sel,
            hourlyRate: sel?.hourlyRate ?? 0,
            fixedRate: sel?.fixedRate ?? 0,
            experienceYears: sel?.experienceYears ?? 0,
            experienceLevel: sel?.experienceLevel ?? 1,
          }
        }),
    }))

    return NextResponse.json({ categories: categoriesOut })
  } catch (error) {
    console.error('Tasker skills list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT: replace the tasker's service selection
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const tasker = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!tasker) return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })

    const body = await request.json()
    const skills: Array<{
      jobId: string
      hourlyRate?: number
      fixedRate?: number
      experienceYears?: number
      experienceLevel?: number
    }> = Array.isArray(body?.skills) ? body.skills : []
    if (skills.length > 200) {
      return NextResponse.json({ error: 'Too many services' }, { status: 400 })
    }

    const jobIds = [...new Set(skills.map(s => s.jobId))]
    if (jobIds.length === 0) {
      await prisma.taskerSkill.deleteMany({ where: { taskerId: tasker.id } })
      return NextResponse.json({ saved: 0 })
    }

    const jobs = await prisma.templateJob.findMany({
      where: { id: { in: jobIds }, isActive: true },
      select: { id: true, isCompanyOnly: true },
    })
    const allowedIds = new Set(jobs.filter(j => !j.isCompanyOnly).map(j => j.id))

    const toSave = skills.filter(s => allowedIds.has(s.jobId))
    const saveIds = toSave.map(s => s.jobId)

    // Remove selections the tasker removed
    await prisma.taskerSkill.deleteMany({
      where: { taskerId: tasker.id, jobId: { notIn: saveIds } },
    })

    let saved = 0
    for (const s of toSave) {
      await prisma.taskerSkill.upsert({
        where: {
          taskerId_jobId: { taskerId: tasker.id, jobId: s.jobId },
        },
        update: {
          hourlyRate: s.hourlyRate != null ? s.hourlyRate : undefined,
          fixedRate: s.fixedRate != null ? s.fixedRate : undefined,
          experienceYears: s.experienceYears != null ? s.experienceYears : undefined,
          experienceLevel: s.experienceLevel != null ? s.experienceLevel : undefined,
        },
        create: {
          taskerId: tasker.id,
          jobId: s.jobId,
          hourlyRate: s.hourlyRate ?? 0,
          fixedRate: s.fixedRate ?? 0,
          experienceYears: s.experienceYears ?? 0,
          experienceLevel: s.experienceLevel ?? 1,
          currency: 'LKR',
        },
      })
      saved++
    }

    return NextResponse.json({ saved })
  } catch (error) {
    console.error('Tasker skills save error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}