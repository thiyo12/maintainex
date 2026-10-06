import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'healthy',
      release: process.env.APP_RELEASE_SHA || 'unknown',
      testOtpMode:
        process.env.NODE_ENV === 'production'
          ? 'disabled'
          : process.env.ALLOW_TEST_OTP === 'true'
            ? 'synthetic-only'
            : 'disabled',
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
