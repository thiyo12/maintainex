import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'healthy',
      release: 'provider-onboarding-fix-20260922',
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
