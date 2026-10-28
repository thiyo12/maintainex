import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { addTaskerProfessionSkill } from '@/lib/profession'

// POST: Add a skill to a tasker's profession
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    // Do not create LK-labelled profiles for an unknown or foreign account.
    const market = (user.countryCode || '').trim().toUpperCase()
    if (market !== 'LK' && market !== 'CA') {
      return NextResponse.json({
        error: 'Provider market is not supported',
        code: 'MARKET_NOT_SUPPORTED',
      }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const taskerProfessionId = body?.taskerProfessionId
    const professionSkillId = body?.professionSkillId
    if (typeof taskerProfessionId !== 'string' || !taskerProfessionId.trim() ||
        typeof professionSkillId !== 'string' || !professionSkillId.trim()) {
      return NextResponse.json({
        error: 'taskerProfessionId and professionSkillId must be nonempty strings',
        code: 'INVALID_PROFESSION_SKILL',
      }, { status: 400 })
    }

    // Attaching a skill requires a pre-existing provider profile and owned
    // profession. Never create a new profile while processing a guessed ID.
    const tasker = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!tasker) {
      return NextResponse.json({
        error: 'Tasker profile not found',
        code: 'TASKER_PROFILE_NOT_FOUND',
      }, { status: 404 })
    }

    const taskerProfession = await prisma.taskerProfession.findUnique({
      where: { id: taskerProfessionId.trim() },
      select: { id: true, taskerProfileId: true },
    })
    if (!taskerProfession) {
      return NextResponse.json({ error: 'Tasker profession not found' }, { status: 404 })
    }
    if (taskerProfession.taskerProfileId !== tasker.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await addTaskerProfessionSkill(prisma, {
      taskerProfessionId: taskerProfessionId.trim(),
      professionSkillId: professionSkillId.trim(),
    })

    return NextResponse.json({ skill: result }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('inactive') || message.includes('does not belong')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    secureConsole.error('Tasker profession skill add error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
