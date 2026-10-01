import { NextRequest } from 'next/server'
import { GET as marketplaceCatalogGet } from '@/app/api/mobile/job-categories/route'

export async function GET(request: NextRequest) {
  return marketplaceCatalogGet(request)
}
