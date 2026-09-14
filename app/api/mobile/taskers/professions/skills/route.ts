import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
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

    const body = await request.json()
    const { taskerProfessionId, professionSkillId } = body
    if (!taskerProfessionId || !professionSkillId) {
      return NextResponse.json({ error: 'taskerProfessionId and professionSkillId required' }, { status: 400 })
    }

    // Verify ownership
    const tasker = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!tasker) return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })

    const taskerProfession = await prisma.taskerProfession.findUnique({
      where: { id: taskerProfessionId },
      select: { id: true, taskerProfileId: true },
    })
    if (!taskerProfession) {
      return NextResponse.json({ error: 'Tasker profession not found' }, { status: 404 })
    }
    if (taskerProfession.taskerProfileId !== tasker.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await addTaskerProfessionSkill(prisma, {
      taskerProfessionId,
      professionSkillId,
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
    console.error('Tasker profession skill add error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
