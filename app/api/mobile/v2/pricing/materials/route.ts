import { NextRequest, NextResponse } from 'next/server'
import { detectMaterials } from '@/lib/materials-detect'

export async function POST(request: NextRequest) {
  try {
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
