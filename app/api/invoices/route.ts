import { secureConsole } from '@/lib/shared/observability/secure-console'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'

function generateInvoiceNumber(): string {
  return `INV-${new Date().getFullYear()}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`
}

function validMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const paymentStatus = searchParams.get('paymentStatus')
    const requestedBranchId = searchParams.get('branchId')

    const scope = await resolveReportBranchScope(guard.context, requestedBranchId)
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const where: any = { isDeleted: false }
    if (scope.scope.branchIds !== null) where.branchId = { in: scope.scope.branchIds }
    if (status) where.status = status
    if (paymentStatus) where.paymentStatus = paymentStatus

    const invoices = await prisma.invoice.findMany({
      where,
      include: { branch: { select: { id: true, name: true } }, items: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    secureConsole.error('Invoices fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'commission:manage',
      permissionClass: 'SENSITIVE',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const body = await request.json()
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      subtotal,
      tax,
      total,
      items,
      dueDate,
      notes,
      branchId,
    } = body

    if (
      typeof customerName !== 'string' ||
      customerName.trim().length < 2 ||
      customerName.length > 160 ||
      typeof branchId !== 'string' ||
      !validMoney(subtotal) ||
      !validMoney(total) ||
      (tax !== undefined && tax !== null && !validMoney(tax))
    ) {
      return NextResponse.json({ error: 'Invalid invoice payload' }, { status: 400 })
    }

    const scope = await resolveReportBranchScope(guard.context, branchId)
    if (!scope.ok || scope.scope.branchId !== branchId) {
      return NextResponse.json(
        { error: scope.ok ? 'Branch is outside your assigned countries' : scope.error },
        { status: scope.ok ? 403 : scope.status }
      )
    }

    const safeItems = Array.isArray(items) ? items.slice(0, 100) : []
    for (const item of safeItems) {
      if (
        !item ||
        typeof item.description !== 'string' ||
        item.description.trim().length === 0 ||
        item.description.length > 500 ||
        !validMoney(Number(item.unitPrice)) ||
        !validMoney(Number(item.totalPrice))
      ) {
        return NextResponse.json({ error: 'Invalid invoice item' }, { status: 400 })
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        branchId,
        customerName: customerName.trim(),
        customerEmail: typeof customerEmail === 'string' ? customerEmail.trim().slice(0, 255) : null,
        customerPhone: typeof customerPhone === 'string' ? customerPhone.trim().slice(0, 40) : null,
        customerAddress: typeof customerAddress === 'string' ? customerAddress.trim().slice(0, 1000) : null,
        subtotal,
        tax: tax || 0,
        total,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: typeof notes === 'string' ? notes.slice(0, 5000) : null,
        createdBy: guard.context.adminId,
        items: safeItems.length > 0 ? {
          create: safeItems.map((item: any) => ({
            description: item.description.trim(),
            quantity: Math.max(Number(item.quantity) || 1, 1),
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
          })),
        } : undefined,
      },
      include: { items: true },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    secureConsole.error('Invoice create error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
