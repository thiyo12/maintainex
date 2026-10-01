export type CrmAccountAction =
  | 'suspend'
  | 'unsuspend'
  | 'ban'
  | 'unban'
  | 'verify_tasker'
  | 'reject_tasker'
  | 'verify_company'
  | 'reject_company'

export function getCrmAccountActionPermission(
  action: CrmAccountAction,
  targetRole: string
): string | null {
  if (action === 'suspend' || action === 'unsuspend') {
    if (targetRole === 'TASKER') return 'taskers:edit'
    if (targetRole === 'COMPANY') return 'companies:edit'
    return 'users:suspend'
  }

  if (action === 'ban' || action === 'unban') {
    if (targetRole === 'TASKER') return 'taskers:ban'
    if (targetRole === 'COMPANY') return 'companies:ban'
    return 'users:ban'
  }

  if (action === 'verify_tasker' || action === 'reject_tasker') return 'taskers:verify'
  if (action === 'verify_company' || action === 'reject_company') return 'companies:verify'
  return null
}

export function crmAccountActionRequiresReason(action: CrmAccountAction): boolean {
  return ['suspend', 'ban', 'reject_tasker', 'reject_company'].includes(action)
}
