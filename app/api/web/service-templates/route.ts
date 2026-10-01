import { NextRequest } from 'next/server'
import { GET as marketplaceServiceTemplatesGet } from '@/app/api/mobile/v2/service-templates/route'

export async function GET(request: NextRequest) {
  return marketplaceServiceTemplatesGet(request)
}
