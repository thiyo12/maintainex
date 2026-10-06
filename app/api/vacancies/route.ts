import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const requestedBranchId = searchParams.get('branchId')
    const adminMode = isActive === 'false' || Boolean(requestedBranchId)

    if (!adminMode) {
      const vacancies = await prisma.jobVacancy.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          isActive: true,
          createdAt: true,
        },
      })
      return NextResponse.json(vacancies)
    }

    const guard = await guardCrmRequest(request, {
      permission: 'users:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const scope = await resolveReportBranchScope(guard.context, requestedBranchId)
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const where: any = {}
    if (isActive === 'true') where.isActive = true
    if (isActive === 'false') where.isActive = false
    if (scope.scope.branchIds !== null) where.branchId = { in: scope.scope.branchIds }

    const vacancies = await prisma.jobVacancy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(vacancies)
  } catch (error) {
    secureConsole.error('Vacancies GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch vacancies' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'users:edit',
      level: 'mutation',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const body = await request.json()
    const { title, description, location, isActive, branchId } = body

    if (typeof title !== 'string' || title.trim().length < 2 || title.length > 200) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    let vacancyBranchId: string | null = typeof branchId === 'string' && branchId ? branchId : null
    if (vacancyBranchId) {
      const scope = await resolveReportBranchScope(guard.context, vacancyBranchId)
      if (!scope.ok || scope.scope.branchId !== vacancyBranchId) {
        return NextResponse.json(
          { error: scope.ok ? 'Branch is outside your assigned countries' : scope.error },
          { status: scope.ok ? 403 : scope.status }
        )
      }
    } else if (!guard.context.isSuperAdmin) {
      return NextResponse.json({ error: 'A branch in your assigned country is required' }, { status: 400 })
    }

    const vacancy = await prisma.jobVacancy.create({
      data: {
        title: title.trim(),
        description: typeof description === 'string' ? description.slice(0, 10000) : null,
        location: typeof location === 'string' ? location.slice(0, 500) : null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        branchId: vacancyBranchId,
      },
    })

    return NextResponse.json(vacancy, { status: 201 })
  } catch (error) {
    secureConsole.error('Vacancies POST error:', error)
    return NextResponse.json({ error: 'Failed to create vacancy' }, { status: 500 })
  }
}
