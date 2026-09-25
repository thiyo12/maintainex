import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  participantFindUnique: vi.fn(),
  messageFindMany: vi.fn(),
  messageUpdateMany: vi.fn(),
  participantUpdateMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    message: { findMany: mocks.messageFindMany, updateMany: mocks.messageUpdateMany },
    conversationParticipant: {
      findUnique: mocks.participantFindUnique,
      updateMany: mocks.participantUpdateMany,
    },
  },
}))

vi.mock('@/lib/mobile-auth', () => ({
  authenticateRequest: mocks.authenticateRequest,
  assertNotSuspended: () => null,
}))

vi.mock('@/lib/fraud-detection', () => ({
  scanChatMessage: vi.fn(async (text: string) => ({ sanitizedText: text, flagged: false, warnings: [] })),
}))

vi.mock('@/lib/push', () => ({
  sendExpoPush: vi.fn(async () => true),
}))

async function loadHandler() {
  const mod = await import('@/app/api/mobile/conversations/[id]/messages/route')
  return mod.GET
}

function makeRequest(url = 'https://maintainex.lk/api/mobile/conversations/conv-1/messages') {
  return new NextRequest(url)
}

const params = { params: Promise.resolve({ id: 'conv-1' }) }

describe('GET /api/mobile/conversations/[id]/messages — participant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 for a non-participant and never reads messages', async () => {
    const GET = await loadHandler()
    mocks.authenticateRequest.mockResolvedValue({ id: 'outsider-user', role: 'COMPANY' })
    mocks.participantFindUnique.mockResolvedValue(null)

    const res = await GET(makeRequest(), params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Conversation not found')
    expect(mocks.messageFindMany).not.toHaveBeenCalled()
    expect(mocks.messageUpdateMany).not.toHaveBeenCalled()
  })

  it('returns messages for a participant and marks received ones read', async () => {
    const GET = await loadHandler()
    mocks.authenticateRequest.mockResolvedValue({ id: 'participant-user', role: 'CUSTOMER' })
    mocks.participantFindUnique.mockResolvedValue({ id: 'cp-1' })
    mocks.messageFindMany.mockResolvedValue([
      {
        id: 'm1',
        senderId: 'participant-user',
        text: 'hello',
        read: false,
        createdAt: new Date('2026-09-25T00:00:00Z'),
      },
      {
        id: 'm2',
        senderId: 'other-user',
        text: 'hi there',
        read: false,
        createdAt: new Date('2026-09-25T00:01:00Z'),
      },
    ])
    mocks.messageUpdateMany.mockResolvedValue({ count: 1 })
    mocks.participantUpdateMany.mockResolvedValue({ count: 1 })

    const res = await GET(makeRequest(), params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[1].text).toBe('hi there')
    expect(mocks.participantFindUnique).toHaveBeenCalledWith({
      where: {
        conversationId_userId: {
          conversationId: 'conv-1',
          userId: 'participant-user',
        },
      },
      select: { id: true },
    })
    expect(mocks.messageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['m2'] } } }),
    )
  })
})
