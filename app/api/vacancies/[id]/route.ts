import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'

async function authorizeVacancy(request: NextRequest, id: string) {
  const guard = await guardCrmRequest(request, {
    permission: 'users:edit',
    level: 'mutation',
    requireCountryScope: true,
  })
  if (!guard.ok) return { ok: false as const, response: guard.response }

  const vacancy = await prisma.jobVacancy.findUnique({ where: { id } })
  if (!vacancy) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Vacancy not found' }, { status: 404 }),
    }
  }

  if (!guard.context.isSuperAdmin) {
    if (!vacancy.branchId) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: 'Vacancy is outside your assigned countries' }, { status: 403 }),
      }
    }
    const scope = await resolveReportBranchScope(guard.context, vacancy.branchId)
    if (!scope.ok) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: scope.error }, { status: scope.status }),
      }
    }
  }

  return { ok: true as const, guard: guard.context, vacancy }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeVacancy(request, id)
    if (!access.ok) return access.response

    await prisma.jobVacancy.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    secureConsole.error('Vacancy DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete vacancy' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeVacancy(request, id)
    if (!access.ok) return access.response

    const body = await request.json()
    const { title, description, location, isActive, branchId } = body

    let nextBranchId: string | undefined
    if (branchId !== undefined) {
      if (typeof branchId !== 'string' || !branchId) {
        return NextResponse.json({ error: 'Invalid branchId' }, { status: 400 })
      }
      const scope = await resolveReportBranchScope(access.guard, branchId)
      if (!scope.ok || scope.scope.branchId !== branchId) {
        return NextResponse.json(
          { error: scope.ok ? 'Branch is outside your assigned countries' : scope.error },
          { status: scope.ok ? 403 : scope.status }
        )
      }
      nextBranchId = branchId
    }

    const vacancy = await prisma.jobVacancy.update({
      where: { id },
      data: {
        ...(typeof title === 'string' && title.trim() && { title: title.trim().slice(0, 200) }),
        ...(description !== undefined && { description: description ? String(description).slice(0, 10000) : null }),
        ...(location !== undefined && { location: location ? String(location).slice(0, 500) : null }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(nextBranchId && { branchId: nextBranchId }),
      },
    })

    return NextResponse.json(vacancy)
  } catch (error) {
    secureConsole.error('Vacancy PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update vacancy' }, { status: 500 })
  }
}
