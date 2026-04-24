import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { branch: true, items: true }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    if (!isSuper && session.branchId !== invoice.branchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const jsPDF = require('jspdf')
    const doc = new jsPDF()

    doc.setFontSize(20)
    doc.text('INVOICE', 20, 20)

    doc.setFontSize(12)
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 35)
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 20, 42)
    if (invoice.dueDate) {
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, 49)
    }

    doc.text('From:', 140, 35)
    doc.text(invoice.branch.name, 140, 42)
    doc.text('To:', 20, 60)
    doc.text(invoice.customerName, 20, 67)
    if (invoice.customerAddress) {
      doc.text(invoice.customerAddress, 20, 74)
    }
    if (invoice.customerPhone) {
      doc.text(invoice.customerPhone, 20, 81)
    }

    const tableData = invoice.items.map(item => [
      item.description,
      item.quantity.toString(),
      `LKR ${item.unitPrice.toLocaleString()}`,
      `LKR ${item.totalPrice.toLocaleString()}`
    ])

    const autoTable = require('jspdf-autotable')
    autoTable(doc, {
      startY: 95,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    doc.text(`Subtotal: LKR ${invoice.subtotal.toLocaleString()}`, 140, finalY)
    doc.text(`Tax: LKR ${invoice.tax.toLocaleString()}`, 140, finalY + 7)
    doc.setFontSize(14)
    doc.text(`Total: LKR ${invoice.total.toLocaleString()}`, 140, finalY + 17)

    if (invoice.notes) {
      doc.setFontSize(10)
      doc.text('Notes:', 20, finalY + 30)
      doc.text(invoice.notes, 20, finalY + 37)
    }

    const pdfBuffer = doc.output('arraybuffer')
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`
      }
    })
  } catch (error) {
    console.error('Invoice PDF error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}