import { describe, it, expect, vi, beforeEach } from 'vitest'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    invoice: {
      findUnique: vi.fn(),
    },
    branch: {
      findUnique: vi.fn(),
    },
    activityLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@/lib/auth/authentication/auth-utils', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/crm/security', () => ({
  guardCrmRequest: vi.fn(),
}))

vi.mock('@/lib/activity-log', () => ({
  getStatsForPeriod: vi.fn().mockResolvedValue({
    bookings: { total: 10, pending: 2, confirmed: 3, inProgress: 1, completed: 3, cancelled: 1 },
    applications: { total: 5, new: 1, reviewed: 2, interview: 1, hired: 0, rejected: 1 },
    adminActivity: { total: 20, logins: 8, creates: 5, updates: 4, deletes: 1, statusChanges: 2 },
  }),
}))

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { GET as invoiceGET } from '@/app/api/invoices/[id]/pdf/route'
import { GET as reportGET } from '@/app/api/reports/export/route'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import { guardCrmRequest } from '@/lib/crm/security'
import { NextRequest, NextResponse } from 'next/server'

function makeRequest(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(url, { headers })
}

const mockedGuard = vi.mocked(guardCrmRequest)

function superGuard() {
  return {
    ok: true as const,
    context: {
      adminId: 'admin-1',
      email: 'admin@test.com',
      role: 'SUPER_ADMIN' as const,
      assignedCountries: [],
      isSuperAdmin: true,
      ipAddress: '127.0.0.1',
      userAgent: null,
      sessionId: 'session-admin-1',
      permissionOverrides: [],
    },
  }
}

describe('PDF Generation — jsPDF 4.x + autotable 5.x', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('jsPDF + autotable basic generation', () => {
    it('generates a valid PDF buffer', () => {
      const doc = new jsPDF()
      doc.text('Test document', 14, 22)

      autoTable(doc, {
        head: [['Name', 'Value']],
        body: [['Item A', '100'], ['Item B', '200']],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      })

      const buffer = doc.output('arraybuffer')
      expect(buffer).toBeInstanceOf(ArrayBuffer)
      expect(buffer.byteLength).toBeGreaterThan(100)

      const bytes = new Uint8Array(buffer)
      expect(bytes[0]).toBe(0x25)
      expect(bytes[1]).toBe(0x50)
      expect(bytes[2]).toBe(0x44)
      expect(bytes[3]).toBe(0x46)
    })

    it('lastAutoTable.finalY is accessible after autoTable call', () => {
      const doc = new jsPDF()
      autoTable(doc, {
        head: [['Col1', 'Col2']],
        body: [['a', 'b'], ['c', 'd'], ['e', 'f']],
      })
      expect((doc as any).lastAutoTable).toBeDefined()
      expect((doc as any).lastAutoTable.finalY).toBeGreaterThan(0)
    })

    it('handles empty body', () => {
      const doc = new jsPDF()
      autoTable(doc, {
        head: [['Col1', 'Col2']],
        body: [],
      })
      const buffer = doc.output('arraybuffer')
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('handles long text without crashing', () => {
      const doc = new jsPDF()
      const longText = 'A'.repeat(2000)
      doc.text(longText, 14, 22, { maxWidth: 180 })

      autoTable(doc, {
        head: [['Description', 'Amount']],
        body: [[longText.substring(0, 200), 'LKR 1,000']],
      })

      const buffer = doc.output('arraybuffer')
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('handles special characters without crashing', () => {
      const doc = new jsPDF()
      doc.text('Invoice #INV-001 — Test & Co. "Ltd"', 14, 22)

      autoTable(doc, {
        head: [['Item', 'Price']],
        body: [
          ['Service <HTML> & "Entities"', 'LKR 5,000'],
          ['Unicode: café résumé', 'LKR 3,000'],
        ],
      })

      const buffer = doc.output('arraybuffer')
      expect(buffer.byteLength).toBeGreaterThan(100)
    })
  })

  describe('Invoice PDF route', () => {
    const mockInvoice = {
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      paymentStatus: 'PENDING',
      createdAt: new Date('2026-01-15'),
      dueDate: new Date('2026-02-15'),
      customerName: 'John Doe',
      customerAddress: '123 Main St, Colombo',
      customerPhone: '+94771234567',
      customerEmail: 'john@example.com',
      subtotal: 10000,
      tax: 1000,
      total: 11000,
      notes: 'Please pay within 30 days',
      branchId: 'branch-1',
      branch: { name: 'Colombo Branch', location: 'Colombo 07' },
      items: [
        { description: 'Deep cleaning service', quantity: 2, unitPrice: 5000, totalPrice: 10000 },
      ],
    }

    it('returns 401 for unauthenticated request', async () => {
      vi.mocked(getSession).mockResolvedValue(null)
      const req = makeRequest('http://localhost:3000/api/invoices/inv-1/pdf')
      const res = await invoiceGET(req, { params: Promise.resolve({ id: 'inv-1' }) })
      expect(res.status).toBe(401)
    })

    it('returns 403 for unauthorized branch access', async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 'user-1', email: 'user@test.com', role: 'STAFF', branchId: 'other-branch',
      } as any)
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue(mockInvoice as any)
      const req = makeRequest('http://localhost:3000/api/invoices/inv-1/pdf')
      const res = await invoiceGET(req, { params: Promise.resolve({ id: 'inv-1' }) })
      expect(res.status).toBe(403)
    })

    it('returns valid PDF for authorized request', async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN', branchId: 'branch-1',
      } as any)
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue(mockInvoice as any)
      const req = makeRequest('http://localhost:3000/api/invoices/inv-1/pdf')
      const res = await invoiceGET(req, { params: Promise.resolve({ id: 'inv-1' }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
      const bytes = new Uint8Array(buffer)
      expect(bytes[0]).toBe(0x25)
      expect(bytes[1]).toBe(0x50)
      expect(bytes[2]).toBe(0x44)
      expect(bytes[3]).toBe(0x46)
    })

    it('handles invoice with minimal fields', async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN', branchId: 'branch-1',
      } as any)
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
        ...mockInvoice,
        customerAddress: null,
        customerPhone: null,
        customerEmail: null,
        notes: null,
        dueDate: null,
        tax: 0,
        items: [{ description: 'Basic service', quantity: 1, unitPrice: 5000, totalPrice: 5000 }],
      } as any)
      const req = makeRequest('http://localhost:3000/api/invoices/inv-1/pdf')
      const res = await invoiceGET(req, { params: Promise.resolve({ id: 'inv-1' }) })
      expect(res.status).toBe(200)
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('handles long customer notes without crashing', async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN', branchId: 'branch-1',
      } as any)
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
        ...mockInvoice,
        notes: 'A'.repeat(500),
      } as any)
      const req = makeRequest('http://localhost:3000/api/invoices/inv-1/pdf')
      const res = await invoiceGET(req, { params: Promise.resolve({ id: 'inv-1' }) })
      expect(res.status).toBe(200)
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('handles multiple invoice items', async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 'admin-1', email: 'admin@test.com', role: 'SUPER_ADMIN', branchId: 'branch-1',
      } as any)
      vi.mocked(prisma.invoice.findUnique).mockResolvedValue({
        ...mockInvoice,
        items: Array.from({ length: 20 }, (_, i) => ({
          description: `Service item ${i + 1} with a reasonably long description`,
          quantity: i + 1,
          unitPrice: (i + 1) * 1000,
          totalPrice: (i + 1) * 1000 * (i + 1),
        })),
      } as any)
      const req = makeRequest('http://localhost:3000/api/invoices/inv-1/pdf')
      const res = await invoiceGET(req, { params: Promise.resolve({ id: 'inv-1' }) })
      expect(res.status).toBe(200)
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })
  })

  describe('Reports PDF route', () => {
    it('returns 401 for unauthenticated request', async () => {
      mockedGuard.mockResolvedValue({
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      })
      const req = makeRequest('http://localhost:3000/api/reports/export?period=month')
      const res = await reportGET(req)
      expect(res.status).toBe(401)
    })

    it('returns valid PDF for authorized request', async () => {
      mockedGuard.mockResolvedValue(superGuard())
      const req = makeRequest('http://localhost:3000/api/reports/export?period=month')
      const res = await reportGET(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
      const bytes = new Uint8Array(buffer)
      expect(bytes[0]).toBe(0x25)
      expect(bytes[1]).toBe(0x50)
      expect(bytes[2]).toBe(0x44)
      expect(bytes[3]).toBe(0x46)
    })

    it('handles weekly period', async () => {
      mockedGuard.mockResolvedValue(superGuard())
      const req = makeRequest('http://localhost:3000/api/reports/export?period=week')
      const res = await reportGET(req)
      expect(res.status).toBe(200)
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('handles yearly period', async () => {
      mockedGuard.mockResolvedValue(superGuard())
      const req = makeRequest('http://localhost:3000/api/reports/export?period=year')
      const res = await reportGET(req)
      expect(res.status).toBe(200)
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('handles activities with long descriptions', async () => {
      mockedGuard.mockResolvedValue(superGuard())
      vi.mocked(prisma.activityLog.findMany).mockResolvedValue([
        {
          id: '1', createdAt: new Date(), adminName: 'Admin User', adminEmail: 'admin@test.com',
          action: 'CREATE', entityType: 'INVOICE', description: 'A'.repeat(200),
          branchId: 'branch-1',
        },
        {
          id: '2', createdAt: new Date(), adminName: null, adminEmail: 'mod@test.com',
          action: 'UPDATE', entityType: 'JOB', description: 'Updated job status with special chars: <>&"\'',
          branchId: 'branch-1',
        },
      ] as any)
      const req = makeRequest('http://localhost:3000/api/reports/export?period=month')
      const res = await reportGET(req)
      expect(res.status).toBe(200)
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })

    it('handles many activities (multi-page)', async () => {
      mockedGuard.mockResolvedValue(superGuard())
      vi.mocked(prisma.activityLog.findMany).mockResolvedValue(
        Array.from({ length: 100 }, (_, i) => ({
          id: String(i), createdAt: new Date(), adminName: `Admin ${i}`,
          adminEmail: `admin${i}@test.com`, action: 'CREATE', entityType: 'INVOICE',
          description: `Activity description ${i}`, branchId: 'branch-1',
        })) as any
      )
      const req = makeRequest('http://localhost:3000/api/reports/export?period=year')
      const res = await reportGET(req)
      expect(res.status).toBe(200)
      const buffer = await res.arrayBuffer()
      expect(buffer.byteLength).toBeGreaterThan(100)
    })
  })
})
