import { prisma } from '@/lib/prisma'
import { hasCompanyPermission, type CompanyRole } from '@/lib/phase6/rbac'

/** Historical profile ownership does NOT confer company job read permissions.
 * Only current active team membership and the specific company permission do.
 */
export async function getReadableCompanyIds(userId: string): Promise<string[]> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { companyId: true, role: true },
  })
  return [...new Set(memberships
    .filter(member => hasCompanyPermission(member.role as CompanyRole, 'quotes:read'))
    .map(member => member.companyId))]
}

/** An assignment ID is NOT sufficient once company membership is removed. */
export async function getActiveAssignedCompanyId(
  jobId: string,
  userId: string,
): Promise<string | null> {
  const assignment = await prisma.companyJobAssignment.findFirst({
    where: {
      jobId,
      workerUserId: userId,
      status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] },
    },
    orderBy: { assignedAt: 'desc' },
    select: { companyId: true },
  })
  if (!assignment) return null
  const activeMember = await prisma.teamMember.findFirst({
    where: { companyId: assignment.companyId, userId, status: 'ACTIVE' },
    select: { id: true },
  })
  return activeMember ? assignment.companyId : null
}
