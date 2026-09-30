import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('chat delivery contract', () => {
  it('does not drop a typed opener when the conversation already exists', () => {
    const route = read('app/api/mobile/conversations/route.ts')

    expect(route).toContain('if (existingConversation)')
    expect(route).toContain('conversationId: existingConversation.id')
    expect(route).toContain('messageSent: Boolean(safeInitialMessage)')
    expect(route).toContain('Daily message limit reached')
  })

  it('creates a CHAT notification for first messages and regular messages', () => {
    const createRoute = read('app/api/mobile/conversations/route.ts')
    const messageRoute = read('app/api/mobile/conversations/[id]/messages/route.ts')

    expect(createRoute).toContain("referenceType: 'CHAT'")
    expect(createRoute).toContain('referenceId: conversation.id')
    expect(messageRoute).toContain("referenceType: 'CHAT'")
    expect(messageRoute).toContain('referenceId: id')
    expect(messageRoute).toContain('recipients.map(recipient =>')
  })

  it('keeps foreground sound enabled and refreshes an active chat immediately', () => {
    const platform = read('apps/mobile/features/notifications/platform.ts')
    const chat = read('apps/mobile/features/messaging/screens/[id].tsx')

    expect(platform).toContain('shouldPlaySound: true')
    expect(platform).toContain('shouldShowAlert: true')
    expect(chat).toContain('addNotificationListeners((notification: any) =>')
    expect(chat).toContain("data.referenceType === 'CHAT'")
    expect(chat).toContain('data.referenceId === id')
    expect(chat).toContain('fetchMessages()')
  })

  it('routes tapped CHAT notifications to the conversation', () => {
    const root = read('apps/mobile/app/_layout.tsx')
    expect(root).toContain("if (referenceType === 'CHAT')")
    expect(root).toContain('router.push(`/(chat)/${referenceId}`')
  })
})
