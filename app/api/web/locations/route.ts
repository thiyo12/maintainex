import { GET as marketplaceLocationsGet } from '@/app/api/mobile/v2/locations/route'

export async function GET() {
  return marketplaceLocationsGet()
}
