import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { requiresPostgres } from '../helpers/test-guard'

const state = vi.hoisted(() => ({ host: 'maintainex.lk' }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: state.host }) }))
vi.mock('../../app/(public)/services/[slug]/ServiceDetailClient', () => ({ default: () => null }))

describe.skipIf(!requiresPostgres())('legacy public service market and review privacy (PostgreSQL)', () => {
  const db = new PrismaClient()
  const prefix = `public-service-${randomUUID()}`
  const slug = `${prefix}-service`
  const services: string[] = [], categories: string[] = []
  let userId = ''

  beforeAll(async () => {
    vi.stubGlobal('React', React)
    const user = await db.user.create({ data: {
      email: `${prefix}@example.invalid`, name: 'Private account fixture', passwordHash: 'test-only',
    } })
    userId = user.id
    for (const countryCode of ['LK', 'CA']) {
      const category = await db.category.create({ data: {
        name: `${prefix}-${countryCode}`, slug: `${prefix}-${countryCode}`, countryCode,
      } })
      categories.push(category.id)
      const service = await db.service.create({ data: {
        name: `${countryCode} service`, slug, description: 'Isolated public service fixture',
        categoryId: category.id, countryCode, price: 100, duration: 60, features: '[]',
      } })
      services.push(service.id)
      await db.review.create({ data: {
        serviceId: service.id, userId, rating: 5, comment: 'Approved public text',
        customerName: 'Consented display name', status: 'APPROVED',
      } })
    }
  })

  afterAll(async () => {
    try {
      await db.review.deleteMany({ where: { serviceId: { in: services } } })
      await db.service.deleteMany({ where: { id: { in: services } } })
      await db.category.deleteMany({ where: { id: { in: categories } } })
      if (userId) await db.user.delete({ where: { id: userId } })
    } finally { vi.unstubAllGlobals(); await db.$disconnect() }
  })

  it.each(['LK', 'CA'])('renders only the %s service and excludes the reviewer account identifier', async countryCode => {
    state.host = countryCode === 'CA' ? 'ca.maintainex.lk' : 'maintainex.lk'
    const { default: Page, generateMetadata } = await import('../../app/(public)/services/[slug]/page')
    const params = Promise.resolve({ slug })
    const tree = await Page({ params })
    const client = tree.props.children.find((child: any) => child.props?.service)
    expect(client.props.service.countryCode).toBe(countryCode)
    expect(client.props.service.reviews).toHaveLength(1)
    expect(client.props.service.reviews[0]).toEqual({
      id: expect.any(String), rating: 5, comment: 'Approved public text',
      customerName: 'Consented display name', createdAt: expect.any(String),
    })
    expect(JSON.stringify(client.props.service)).not.toContain(userId)
    const metadata = await generateMetadata({ params })
    expect(metadata.title).toContain(`${countryCode} service`)
  })
})
