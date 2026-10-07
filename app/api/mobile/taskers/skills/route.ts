import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { getCurrencyForCountry } from '@/lib/shared/money/money'

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

    const tasker = await prisma.taskerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, countryCode: user.countryCode || 'LK' },
      select: { id: true },
    })

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
    secureConsole.error('Tasker skills list error:', error)
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

    const tasker = await prisma.taskerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, countryCode: user.countryCode || 'LK' },
      select: { id: true },
    })

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

    for (const skill of skills) {
      if (!skill || typeof skill.jobId !== 'string' || !skill.jobId.trim()) {
        return NextResponse.json({ error: 'Each service requires a valid jobId' }, { status: 400 })
      }
      for (const [field, value] of [
        ['hourlyRate', skill.hourlyRate],
        ['fixedRate', skill.fixedRate],
      ] as const) {
        if (value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
          return NextResponse.json({ error: `${field} must be a non-negative number` }, { status: 400 })
        }
      }
      if (
        skill.experienceYears !== undefined &&
        (!Number.isInteger(Number(skill.experienceYears)) ||
          Number(skill.experienceYears) < 0 ||
          Number(skill.experienceYears) > 80)
      ) {
        return NextResponse.json({ error: 'experienceYears must be an integer from 0 to 80' }, { status: 400 })
      }
      if (
        skill.experienceLevel !== undefined &&
        (!Number.isInteger(Number(skill.experienceLevel)) ||
          Number(skill.experienceLevel) < 1 ||
          Number(skill.experienceLevel) > 5)
      ) {
        return NextResponse.json({ error: 'experienceLevel must be an integer from 1 to 5' }, { status: 400 })
      }
    }

    const jobIds = [...new Set(skills.map(s => s.jobId.trim()))]
    if (jobIds.length === 0) {
      await prisma.taskerSkill.deleteMany({ where: { taskerId: tasker.id } })
      await prisma.taskerProfile.update({ where: { id: tasker.id }, data: { skills: '[]' } })
      return NextResponse.json({ saved: 0 })
    }

    const jobs = await prisma.templateJob.findMany({
      where: { id: { in: jobIds }, isActive: true },
      select: { id: true, isCompanyOnly: true, categoryId: true },
    })
    const allowedIds = new Set(jobs.filter(j => !j.isCompanyOnly).map(j => j.id))

    const toSave = skills.filter(s => allowedIds.has(s.jobId.trim()))
    const saveIds = toSave.map(s => s.jobId.trim())

    // Remove selections the tasker removed
    await prisma.taskerSkill.deleteMany({
      where: { taskerId: tasker.id, jobId: { notIn: saveIds } },
    })

    let saved = 0
    for (const s of toSave) {
      await prisma.taskerSkill.upsert({
        where: {
          taskerId_jobId: { taskerId: tasker.id, jobId: s.jobId.trim() },
        },
        update: {
          hourlyRate: s.hourlyRate != null ? Number(s.hourlyRate) : undefined,
          fixedRate: s.fixedRate != null ? Number(s.fixedRate) : undefined,
          experienceYears: s.experienceYears != null ? Number(s.experienceYears) : undefined,
          experienceLevel: s.experienceLevel != null ? Number(s.experienceLevel) : undefined,
          currency: getCurrencyForCountry(user.countryCode),
        },
        create: {
          taskerId: tasker.id,
          jobId: s.jobId.trim(),
          hourlyRate: Number(s.hourlyRate ?? 0),
          fixedRate: Number(s.fixedRate ?? 0),
          experienceYears: Number(s.experienceYears ?? 0),
          experienceLevel: Number(s.experienceLevel ?? 1),
          currency: getCurrencyForCountry(user.countryCode),
        },
      })
      saved++
    }

    // Keep the category-level skills (used by job matching + the tasker job feed)
    // in sync with the detailed service selection.
    await syncCategorySkills(tasker.id, jobs.filter(j => allowedIds.has(j.id)))

    return NextResponse.json({ saved })
  } catch (error) {
    secureConsole.error('Tasker skills save error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function syncCategorySkills(taskerId: string, selectedJobs: { id: string; categoryId: string }[]): Promise<void> {
  const categoryIds = [...new Set(selectedJobs.map(j => j.categoryId).filter(Boolean))]
  if (categoryIds.length === 0) {
    await prisma.taskerProfile.update({ where: { id: taskerId }, data: { skills: '[]' } })
    return
  }

  const jobCats = await prisma.jobCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, slug: true },
  })

  // Store the JobCategory id + slug (the canonical namespace used by job
  // matching/blasting and the tasker search). A mapped legacy Category slug is
  // retained as an alias so previously-onboarded taskers keep matching.
  const marketplace = await prisma.category.findMany({
    where: { isActive: true },
    select: { name: true, slug: true },
  })
  const legacyByJobName = new Map<string, string>()
  for (const c of marketplace) {
    for (const jc of jobCats) {
      if (c.name.toLowerCase().includes(jc.name.toLowerCase()) || jc.name.toLowerCase().includes(c.name.toLowerCase())) {
        legacyByJobName.set(jc.id, c.slug)
      }
    }
  }

  const keys: string[] = []
  for (const jc of jobCats) {
    keys.push(jc.id)
    if (jc.slug) keys.push(jc.slug)
    const alias = legacyByJobName.get(jc.id)
    if (alias && alias !== jc.slug) keys.push(alias)
  }

  await prisma.taskerProfile.update({
    where: { id: taskerId },
    data: { skills: JSON.stringify([...new Set(keys)]) },
  })
}