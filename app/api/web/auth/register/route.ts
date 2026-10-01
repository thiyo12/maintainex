import { NextRequest } from 'next/server'
import { POST as marketplaceRegister } from '@/app/api/mobile/auth/register/route'

export async function POST(request: NextRequest) {
  return marketplaceRegister(request)
}
