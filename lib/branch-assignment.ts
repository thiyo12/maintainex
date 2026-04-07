import { prisma } from './prisma'

export async function getBranchForDistrict(district: string): Promise<string | null> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true }
  })

  for (const branch of branches) {
    const districts: string[] = JSON.parse(branch.districts || '[]')
    if (districts.includes(district)) {
      return branch.id
    }
  }

  return null
}

export async function getBranchForDistrictSync(district: string, branches: { id: string; districts: string }[]): Promise<string | null> {
  for (const branch of branches) {
    const districts: string[] = JSON.parse(branch.districts || '[]')
    if (districts.includes(district)) {
      return branch.id
    }
  }
  return null
}
