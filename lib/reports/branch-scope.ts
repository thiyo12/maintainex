import { prisma } from '@/lib/prisma'
import type { AdminSession } from '@/lib/admin-types'

/**
 * Canonical branch scoping for reporting endpoints.
 *
 * SUPER_ADMIN keeps the pre-existing broad behaviour: an explicit branch is used as-is,
 * and no branch restriction is applied when none is requested.
 *
 * Every other role is scoped by the admin's canonical `assignedCountries`. A `branchId`
 * query is never trusted on its own: the branch is loaded from the database and its
 * country must be inside the admin's assigned countries, otherwise the request is
 * rejected. A non-super-admin therefore never falls back to "all branches" / "all activity".
 *
 * Note on the column: the `Branch` model has no `countryCode` column — it stores the
 * country code in `region` (`region String @default("LK")`, with `province` holding the
 * province). This mirrors the canonical `getCountryFilter` decision from
 * `lib/auth/authorization/admin-rbac`, applied to the column Branch actually has.
 */
export interface ReportBranchScope {
  /** Branches the report may read. `null` means unrestricted (SUPER_ADMIN, no branch requested). */
  branchIds: string[] | null
  /** The explicitly selected branch, when one is in scope. */
  branchId: string | null
  /** Canonical country filter for branches (empty object only for SUPER_ADMIN). */
  branchCountryFilter: Record<string, any>
}

export type ReportBranchScopeResult =
  | { ok: true; scope: ReportBranchScope }
  | { ok: false; status: 403 | 404; error: string }

function normalizeCountries(assignedCountries?: string[] | null): string[] {
  if (!Array.isArray(assignedCountries)) return []
  return assignedCountries
    .filter((code): code is string => typeof code === 'string')
    .map(code => code.trim().toUpperCase())
    .filter(code => code.length > 0)
}

export async function resolveReportBranchScope(
  session: Pick<AdminSession, 'role' | 'assignedCountries'>,
  requestedBranchId: string | null
): Promise<ReportBranchScopeResult> {
  const requested = typeof requestedBranchId === 'string' && requestedBranchId.trim().length > 0
    ? requestedBranchId.trim()
    : null

  if (session.role === 'SUPER_ADMIN') {
    return {
      ok: true,
      scope: {
        branchIds: requested ? [requested] : null,
        branchId: requested,
        branchCountryFilter: {},
      },
    }
  }

  const assignedCountries = normalizeCountries(session.assignedCountries)
  if (assignedCountries.length === 0) {
    return { ok: false, status: 403, error: 'No country assigned to this admin account' }
  }

  // Deny-all sentinel mirrors getCountryFilter(): an admin with no assigned country
  // can never reach a branch.
  const branchCountryFilter: Record<string, any> = { region: { in: assignedCountries } }

  if (requested) {
    const branch = await prisma.branch.findUnique({
      where: { id: requested },
      select: { id: true, region: true },
    })

    if (!branch) {
      return { ok: false, status: 404, error: 'Branch not found' }
    }

    const branchCountry = typeof branch.region === 'string' ? branch.region.trim().toUpperCase() : ''
    if (!branchCountry || !assignedCountries.includes(branchCountry)) {
      return { ok: false, status: 403, error: 'Branch is outside your assigned countries' }
    }

    return { ok: true, scope: { branchIds: [branch.id], branchId: branch.id, branchCountryFilter } }
  }

  const allowedBranches = await prisma.branch.findMany({
    where: branchCountryFilter,
    select: { id: true },
  })

  return {
    ok: true,
    scope: {
      // An empty array is a deny-all scope: `branchId: { in: [] }` matches nothing.
      branchIds: allowedBranches.map(branch => branch.id),
      branchId: null,
      branchCountryFilter,
    },
  }
}
