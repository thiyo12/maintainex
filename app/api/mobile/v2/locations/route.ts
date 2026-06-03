import { NextResponse } from 'next/server'
import { getCountries } from '@/lib/locations'

export async function GET() {
  try {
    const countries = getCountries()
    return NextResponse.json({ countries })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load locations' }, { status: 500 })
  }
}
