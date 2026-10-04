import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'

function validMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

async function authorizeInvoice(
  request: NextRequest,
  id: string,
  permission: 'commission:view' | 'commission:manage',
  level: 'read' | 'sensitive',
) {
  const guard = await guardCrmRequest(request, {
    permission,
    permissionClass: permission === 'commission:manage' ? 'SENSITIVE' : 'READ',
    level,
    requireCountryScope: true,
  })
  if (!guard.ok) return { ok: false as const, response: guard.response }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { branch: true, items: true },
  })
  if (!invoice || invoice.isDeleted) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Invoice not found' }, { status: 404 }),
    }
  }

  if (!guard.context.isSuperAdmin) {
    const scope = await resolveReportBranchScope(guard.context, invoice.branchId)
    if (!scope.ok) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: scope.error }, { status: scope.status }),
      }
    }
  }

  return { ok: true as const, guard: guard.context, invoice }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeInvoice(request, id, 'commission:view', 'read')
    if (!access.ok) return access.response
    return NextResponse.json(access.invoice)
  } catch (error) {
    secureConsole.error('Invoice fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeInvoice(request, id, 'commission:manage', 'sensitive')
    if (!access.ok) return access.response

    const body = await request.json()
    const updateData: Record<string, unknown> = {}

    for (const key of ['customerName', 'customerEmail', 'customerPhone', 'customerAddress', 'notes', 'status', 'paymentStatus'] as const) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string') {
          return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
        }
        updateData[key] = body[key].trim().slice(0, key === 'notes' ? 5000 : 1000)
      }
    }

    for (const key of ['subtotal', 'tax', 'total'] as const) {
      if (body[key] !== undefined) {
        if (!validMoney(body[key])) {
          return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
        }
        updateData[key] = body[key]
      }
    }

    if (body.dueDate !== undefined) {
      const parsed = body.dueDate ? new Date(body.dueDate) : null
      if (parsed && Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid dueDate' }, { status: 400 })
      }
      updateData.dueDate = parsed
    }

    const items = body.items
    if (items !== undefined && !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid invoice items' }, { status: 400 })
    }

    const safeItems = Array.isArray(items) ? items.slice(0, 100) : null
    if (safeItems) {
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
    }

    const invoice = await prisma.$transaction(async tx => {
      const updated = await tx.invoice.update({
        where: { id },
        data: updateData,
      })

      if (safeItems) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } })
        if (safeItems.length > 0) {
          await tx.invoiceItem.createMany({
            data: safeItems.map((item: any) => ({
              invoiceId: id,
              description: item.description.trim(),
              quantity: Math.max(Number(item.quantity) || 1, 1),
              unitPrice: Number(item.unitPrice),
              totalPrice: Number(item.totalPrice),
            })),
          })
        }
      }

      return tx.invoice.findUnique({
        where: { id: updated.id },
        include: { branch: true, items: true },
      })
    })

    return NextResponse.json(invoice)
  } catch (error) {
    secureConsole.error('Invoice update error:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeInvoice(request, id, 'commission:manage', 'sensitive')
    if (!access.ok) return access.response

    await prisma.invoice.update({
      where: { id },
      data: { isDeleted: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    secureConsole.error('Invoice delete error:', error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
