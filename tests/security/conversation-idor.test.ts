import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('conversation IDOR authorization contracts', () => {
  it('requires participant membership for conversation detail reads', () => {
    const route = source('app/api/mobile/conversations/[id]/route.ts')
    expect(route).toContain('authenticateRequest(request)')
    expect(route).toContain('participants: { some: { userId: user.id } }')
    expect(route).toContain("status: 404")
  })

  it('requires participant membership before message reads or writes', () => {
    const route = source('app/api/mobile/conversations/[id]/messages/route.ts')
    expect(route).toContain('authenticateRequest(request)')
    expect((route.match(/participants: \{ some: \{ userId: user\.id \} \}/g) || []).length)
      .toBeGreaterThanOrEqual(2)
    expect(route).toContain('conversationId_userId')
    expect(route).toContain('userId: user.id')
  })

  it('lists only conversations where the caller is a participant', () => {
    const route = source('app/api/mobile/conversations/route.ts')
    expect(route).toContain('participants: { some: { userId: user.id } }')
  })

  it('authorizes a new chat against the persisted job and provider relationship before creation', () => {
    const route = source('app/api/mobile/conversations/route.ts')
    expect(route).toContain('canStartConversationForJob')
    expect(route).toContain('userId === job.customerId')
    expect(route).toContain("providerType: 'INDIVIDUAL'")
    expect(route).toContain("providerType: 'COMPANY'")
    expect(route).toContain('companyIdsForMessaging')

    const authIndex = route.indexOf('const authorized = await canStartConversationForJob')
    const denyIndex = route.indexOf('if (!authorized)', authIndex)
    const createIndex = route.indexOf('prisma.conversation.create', denyIndex)
    expect(authIndex).toBeGreaterThan(-1)
    expect(denyIndex).toBeGreaterThan(authIndex)
    expect(createIndex).toBeGreaterThan(denyIndex)
  })
})
