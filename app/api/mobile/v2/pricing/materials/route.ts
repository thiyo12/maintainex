import { NextRequest, NextResponse } from 'next/server'
import { detectMaterials } from '@/lib/materials-detect'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const { categoryId, description, title, countryCode } = body

    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
    }

    const text = [title, description].filter(Boolean).join(' ')
    const result = detectMaterials(categoryId, text, countryCode || 'LK')

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to detect materials' },
      { status: 500 }
    )
  }
}
