import { prisma } from './prisma'

export async function getBranchForDistrict(district: string): Promise<string | null> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    take: 1
  })
  return branches[0]?.id || null
}

export async function getBranchForDistrictSync(district: string, branches: { id: string }[]): Promise<string | null> {
  return branches[0]?.id || null
}
