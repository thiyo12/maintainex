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

    // Header
    doc.setFillColor(59, 130, 246)
    doc.rect(0, 0, 210, 40, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('MAINTAINEX', 20, 20)
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Professional Cleaning & Maintenance Services', 20, 30)
    
    // Company Info in header
    doc.setFontSize(9)
    doc.text('Tel: 077 086 7609', 140, 15)
    doc.text('Email: info@maintainex.lk', 140, 22)
    doc.text('Web: www.maintainex.lk', 140, 29)

    // Invoice Details
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 20, 55)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 20, 65)
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 20, 72)
    if (invoice.dueDate) {
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, 20, 79)
    }
    doc.text(`Status: ${invoice.paymentStatus}`, 20, 86)

    // From (Company)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('From:', 120, 65)
    doc.setFont('helvetica', 'normal')
    doc.text(invoice.branch.name, 120, 72)
    if (invoice.branch.location) {
      doc.text(invoice.branch.location.substring(0, 30), 120, 79)
    }

    // Bill To (Customer)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', 20, 100)
    doc.setFont('helvetica', 'normal')
    doc.text(invoice.customerName, 20, 107)
    if (invoice.customerAddress) {
      doc.text(invoice.customerAddress.substring(0, 40), 20, 114)
    }
    if (invoice.customerPhone) {
      doc.text(`Tel: ${invoice.customerPhone}`, 20, 121)
    }
    if (invoice.customerEmail) {
      doc.text(invoice.customerEmail, 20, 128)
    }

    // Items Table
    const tableData = invoice.items.map(item => [
      item.description,
      item.quantity.toString(),
      `LKR ${item.unitPrice.toLocaleString()}`,
      `LKR ${item.totalPrice.toLocaleString()}`
    ])

    const autoTable = require('jspdf-autotable')
    autoTable(doc, {
      startY: 140,
      head: [['Description', 'Qty', 'Unit Price', 'Total (LKR)']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      }
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10
    
    // Totals
    doc.setFontSize(10)
    doc.text(`Subtotal:`, 140, finalY)
    doc.text(`LKR ${invoice.subtotal.toLocaleString()}`, 180, finalY, { align: 'right' })
    
    if (invoice.tax > 0) {
      doc.text(`Tax:`, 140, finalY + 7)
      doc.text(`LKR ${invoice.tax.toLocaleString()}`, 180, finalY + 7, { align: 'right' })
    }
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total:`, 140, finalY + 17)
    doc.setTextColor(59, 130, 246)
    doc.text(`LKR ${invoice.total.toLocaleString()}`, 180, finalY + 17, { align: 'right' })
    doc.setTextColor(0, 0, 0)

    // Payment Info
    const paymentY = finalY + 35
    doc.setFillColor(240, 240, 240)
    doc.rect(120, paymentY - 5, 90, 35, 'F')
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Payment Details', 125, paymentY + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Bank: Commercial Bank', 125, paymentY + 10)
    doc.text('Account: 1234567890', 125, paymentY + 16)
    doc.text('Branch: Colombo', 125, paymentY + 22)

    // Notes
    if (invoice.notes) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Notes:', 20, finalY + 30)
      doc.setFont('helvetica', 'normal')
      const noteLines = doc.splitTextToSize(invoice.notes, 100)
      doc.text(noteLines, 20, finalY + 38)
    }

    // Footer
    const footerY = 270
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text('Thank you for choosing Maintainex!', 105, footerY, { align: 'center' })
    doc.text('Please contact us if you have any questions.', 105, footerY + 5, { align: 'center' })

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