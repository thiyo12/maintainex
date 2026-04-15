import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

const ALL_DISTRICTS = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya'
].sort()

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all branches with their districts
    const branches = await prisma.branch.findMany({
      where: session.role !== 'SUPER_ADMIN' ? { id: session.branchId } : undefined,
      select: {
        id: true,
        name: true,
        districts: true,
        isActive: true
      }
    })

    // Fetch active bookings count by district
    const activeBookings = await prisma.booking.groupBy({
      by: ['district'],
      where: {
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
        ...(session.role !== 'SUPER_ADMIN' ? { branchId: session.branchId } : {})
      },
      _count: true
    })

    // Create a map of district to booking count
    const bookingCountMap: Record<string, number> = {}
    activeBookings.forEach(item => {
      if (item.district) {
        bookingCountMap[item.district] = item._count
      }
    })

    // Process districts data
    const districtData = ALL_DISTRICTS.map(district => {
      // Count branches serving this district
      const servingBranches = branches.filter(branch => {
        if (!branch.districts) return false
        try {
          const parsedDistricts = JSON.parse(branch.districts)
          return Array.isArray(parsedDistricts) && parsedDistricts.includes(district)
        } catch {
          return false
        }
      })

      return {
        name: district,
        branchCount: servingBranches.length,
        branches: servingBranches.map(b => ({ id: b.id, name: b.name, isActive: b.isActive })),
        activeBookings: bookingCountMap[district] || 0
      }
    })

    // Sort by name alphabetically
    districtData.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(districtData)
  } catch (error) {
    console.error('Error fetching districts:', error)
    return NextResponse.json({ error: 'Failed to fetch districts' }, { status: 500 })
  }
}
