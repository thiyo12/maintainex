import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { assignTaskerProfession, getTaskerProfessions } from '@/lib/profession'

// GET: List current tasker's professions
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

    const professions = await getTaskerProfessions(prisma, tasker.id)
    return NextResponse.json({ professions })
  } catch (error) {
    console.error('Tasker professions list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: Assign a profession to the current tasker
export async function POST(request: NextRequest) {
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
    const { professionId } = body
    if (!professionId) {
      return NextResponse.json({ error: 'professionId required' }, { status: 400 })
    }

    const existing = await prisma.taskerProfession.findUnique({
      where: {
        taskerProfileId_professionId: {
          taskerProfileId: tasker.id,
          professionId,
        },
      },
      select: { id: true, status: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Profession already assigned', status: existing.status },
        { status: 409 }
      )
    }

    const result = await assignTaskerProfession(prisma, {
      taskerProfileId: tasker.id,
      professionId,
    })

    return NextResponse.json({ profession: result }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('inactive')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Profession already assigned' }, { status: 409 })
    }
    console.error('Tasker profession assign error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
