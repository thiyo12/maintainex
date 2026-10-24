import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> },
) {
  const user = await authenticateRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const blocked = assertNotSuspended(user)
  if (blocked) return blocked
  const { id, shareId } = await params
  const changed = await prisma.trustedContactShare.updateMany({
    where: { id: shareId, jobId: id, actorUserId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (changed.count !== 1) return NextResponse.json({ error: 'Active share not found' }, { status: 404 })
  return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } })
}
