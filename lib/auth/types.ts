export type PrincipalType = 'MARKETPLACE_USER' | 'STAFF'

export interface MarketplacePrincipal {
  principalType: 'MARKETPLACE_USER'
  userId: string
  sessionId: string
}

export interface StaffPrincipal {
  principalType: 'STAFF'
  adminUserId: string
  sessionId: string
}

export type AuthPrincipal = MarketplacePrincipal | StaffPrincipal
