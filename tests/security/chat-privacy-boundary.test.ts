import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('chat privacy boundary', () => {
  it('does not expose participant email addresses from conversation detail', () => {
    const route = read('app/api/mobile/conversations/[id]/route.ts')
    expect(route).not.toContain('email: p.user.email')
    expect(route).not.toContain('email: true,\n                taskerProfile')
  })

  it('does not fetch recipient email for message delivery', () => {
    const route = read('app/api/mobile/conversations/[id]/messages/route.ts')
    expect(route).not.toContain('pushToken: true, email: true')
  })

  it('caps message input before fraud scanning and persistence', () => {
    const route = read('app/api/mobile/conversations/[id]/messages/route.ts')
    const limitIndex = route.indexOf('rawMessage.length > 4000')
    const scanIndex = route.indexOf('scanChatMessage(rawMessage')

    expect(limitIndex).toBeGreaterThan(-1)
    expect(scanIndex).toBeGreaterThan(limitIndex)
  })
})
