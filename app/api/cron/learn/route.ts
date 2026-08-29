import { NextRequest, NextResponse } from 'next/server'
import { runLearningCycle } from '@/lib/learning-engine'

if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runLearningCycle()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Learning cycle failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rawAuth = request.headers.get('authorization')
  if (rawAuth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runLearningCycle()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Learning cycle failed' }, { status: 500 })
  }
}
