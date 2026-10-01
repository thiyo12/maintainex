import { describe, expect, it, vi } from 'vitest'
import { banUser, reactivateUser, suspendUser, unbanUser } from '@/lib/domain/admin-suspension'
import type { AdminSession } from '@/lib/admin-types'

const session: AdminSession = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'SUPER_ADMIN',
  firstName: 'Admin',
  lastName: 'User',
  assignedCountries: [],
  authType: 'adminUser',
}

function mockClient(initial: Record<string, any>) {
  let state = { ...initial }
  const auditCreate = vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'audit-1', ...data }))
  const update = vi.fn().mockImplementation(({ data, select }: any) => {
    state = { ...state, ...data }
    const result: Record<string, any> = {}
    for (const key of Object.keys(select || {})) {
      if (select[key]) result[key] = state[key]
    }
    return Promise.resolve(result)
  })
  const db: any = {
    user: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve({ ...state })),
      update,
    },
    userSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: auditCreate },
  }
  const client: any = {
    $transaction: vi.fn(async (fn: any) => fn(db)),
    _db: db,
    _state: () => state,
  }
  return client
}

describe('CRM account restriction domain', () => {
  it('suspends a customer and writes the audit inside the same transaction', async () => {
    const client = mockClient({
      id: 'customer-1',
      email: 'customer@example.com',
      name: 'Customer',
      role: 'CUSTOMER',
      isSuspended: false,
      isBanned: false,
      countryCode: 'LK',
      suspensionReason: null,
      suspendedUntil: null,
    })

    await suspendUser(client, {
      userId: 'customer-1',
      reason: 'Repeated abuse',
      scope: 'ALL',
      session,
      ipAddress: '127.0.0.1',
    })

    expect(client.$transaction).toHaveBeenCalledTimes(1)
    expect(client._state()).toMatchObject({
      isSuspended: true,
      suspensionReason: 'Repeated abuse',
    })
    expect(client._db.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'customer-1', isValid: true },
      data: expect.objectContaining({
        isValid: false,
        revokeReason: 'ACCOUNT_SUSPENDED',
      }),
    })
    expect(client._db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SUSPEND',
          targetId: 'customer-1',
        }),
      })
    )
  })

  it('uses provider suspension audit vocabulary for taskers', async () => {
    const client = mockClient({
      id: 'tasker-1',
      email: 'tasker@example.com',
      name: 'Tasker',
      role: 'TASKER',
      isSuspended: false,
      isBanned: false,
      countryCode: 'LK',
      suspensionReason: null,
      suspendedUntil: null,
    })

    await suspendUser(client, {
      userId: 'tasker-1',
      reason: 'Marketplace investigation',
      scope: 'MARKETPLACE',
      session,
      ipAddress: '127.0.0.1',
    })

    expect(client._db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'PROVIDER_SUSPEND' }),
      })
    )
  })

  it('reactivates a suspended account without changing ban state', async () => {
    const client = mockClient({
      id: 'tasker-1',
      email: 'tasker@example.com',
      name: 'Tasker',
      role: 'TASKER',
      isSuspended: true,
      isBanned: false,
      countryCode: 'LK',
      suspensionReason: 'Review',
      suspendedUntil: null,
    })

    await reactivateUser(client, {
      userId: 'tasker-1',
      reason: 'Review cleared',
      session,
      ipAddress: '127.0.0.1',
    })

    expect(client._state()).toMatchObject({
      isSuspended: false,
      isBanned: false,
      suspensionReason: null,
      suspendedUntil: null,
    })
  })

  it('bans an account and writes BAN audit atomically', async () => {
    const client = mockClient({
      id: 'tasker-1',
      email: 'tasker@example.com',
      name: 'Tasker',
      role: 'TASKER',
      isActive: true,
      isSuspended: false,
      isBanned: false,
      banReason: null,
      countryCode: 'LK',
    })

    await banUser(client, {
      userId: 'tasker-1',
      reason: 'Confirmed fraud',
      session,
      ipAddress: '127.0.0.1',
    })

    expect(client.$transaction).toHaveBeenCalledTimes(1)
    expect(client._state()).toMatchObject({
      isActive: false,
      isBanned: true,
      banReason: 'Confirmed fraud',
    })
    expect(client._db.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'tasker-1', isValid: true },
      data: expect.objectContaining({
        isValid: false,
        revokeReason: 'ACCOUNT_BANNED',
      }),
    })
    expect(client._db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'BAN' }),
      })
    )
  })

  it('unbans without clearing an independent suspension', async () => {
    const client = mockClient({
      id: 'company-owner-1',
      email: 'owner@example.com',
      name: 'Owner',
      role: 'COMPANY',
      isActive: false,
      isSuspended: true,
      isBanned: true,
      banReason: 'Policy violation',
      countryCode: 'LK',
    })

    await unbanUser(client, {
      userId: 'company-owner-1',
      reason: 'Appeal approved',
      session,
      ipAddress: '127.0.0.1',
    })

    expect(client._state()).toMatchObject({
      isActive: true,
      isSuspended: true,
      isBanned: false,
      banReason: null,
    })
    expect(client._db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'UNBAN' }),
      })
    )
  })
})
