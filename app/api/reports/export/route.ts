import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { getStatsForPeriod } from '@/lib/activity-log'
import { prisma } from '@/lib/prisma'

function getDateRange(period: string): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  
  switch (period) {
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'year':
      start.setFullYear(start.getFullYear() - 1)
      break
    default:
      start.setMonth(start.getMonth() - 1)
  }
  
  return { start, end }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const userBranchId = session.branchId

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'month'
    const branchId = searchParams.get('branchId') || undefined

    const { start, end } = getDateRange(period)

    let filterBranchId = undefined
    if (!isSuper && userBranchId) {
      filterBranchId = userBranchId
    } else if (branchId) {
      filterBranchId = branchId
    }

    const stats = await getStatsForPeriod(start, end, filterBranchId)

    let branchName = 'All Branches'
    if (filterBranchId) {
      const branch = await prisma.branch.findUnique({ where: { id: filterBranchId } })
      branchName = branch?.name || 'Branch'
    }

    const allActivities = await prisma.activityLog.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(filterBranchId ? { branchId: filterBranchId } : {})
      },
      orderBy: { createdAt: 'desc' }
    })

    const doc = new (require('jspdf')).jsPDF()

    doc.setFontSize(20)
    doc.setTextColor(30, 41, 59)
    doc.text('Maintain Reports', 14, 22)

    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    const periodLabel = period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'Yearly'
    const dateRange = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
    doc.text(`${periodLabel} Report - ${branchName}`, 14, 32)
    doc.text(`(${dateRange})`, 14, 38)

    doc.setDrawColor(255, 195, 0)
    doc.setLineWidth(0.5)
    doc.line(14, 42, 196, 42)

    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text('Bookings Summary', 14, 54)

    const { default: autoTable } = require('jspdf-autotable')
    autoTable(doc, {
      startY: 58,
      head: [['Metric', 'Count']],
      body: [
        ['Total Bookings', stats.bookings.total.toString()],
        ['Pending', stats.bookings.pending.toString()],
        ['Confirmed', stats.bookings.confirmed.toString()],
        ['In Progress', stats.bookings.inProgress.toString()],
        ['Completed', stats.bookings.completed.toString()],
        ['Cancelled', stats.bookings.cancelled.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [255, 195, 0], textColor: [31, 41, 55] },
    })

    let currentY = doc.lastAutoTable.finalY + 15

    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text('Applications Summary', 14, currentY)

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Metric', 'Count']],
      body: [
        ['Total Applications', stats.applications.total.toString()],
        ['New', stats.applications.new.toString()],
        ['Reviewed', stats.applications.reviewed.toString()],
        ['Interview', stats.applications.interview.toString()],
        ['Hired', stats.applications.hired.toString()],
        ['Rejected', stats.applications.rejected.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    })

    currentY = doc.lastAutoTable.finalY + 15

    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text('Admin Activity Summary', 14, currentY)

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Action', 'Count']],
      body: [
        ['Total Actions', stats.adminActivity.total.toString()],
        ['Logins', stats.adminActivity.logins.toString()],
        ['Creates', stats.adminActivity.creates.toString()],
        ['Updates', stats.adminActivity.updates.toString()],
        ['Deletes', stats.adminActivity.deletes.toString()],
        ['Status Changes', stats.adminActivity.statusChanges.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
    })

    currentY = doc.lastAutoTable.finalY + 15

    doc.setFontSize(14)
    doc.setTextColor(30, 41, 59)
    doc.text(`Complete Activity Log (${allActivities.length} activities)`, 14, currentY)

    const activityBody = allActivities.map(activity => [
      new Date(activity.createdAt).toLocaleString(),
      activity.adminName || activity.adminEmail,
      activity.action,
      activity.entityType,
      activity.description.length > 60 ? activity.description.substring(0, 60) + '...' : activity.description,
    ])

    autoTable(doc, {
      startY: currentY + 4,
      head: [['Date & Time', 'Admin', 'Action', 'Entity', 'Description']],
      body: activityBody,
      theme: 'striped',
      headStyles: { fillColor: [107, 114, 128], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22 },
        4: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: function(data: any) {
        if (data.pageNumber > 1) {
          doc.setFontSize(10)
          doc.setTextColor(150, 150, 150)
          doc.text(
            `Maintain Reports - ${periodLabel} - ${branchName} - Page ${data.pageNumber}`,
            14,
            285
          )
        }
      }
    })

    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Generated on ${new Date().toLocaleString()} by ${session.email}`,
      14,
      285
    )

    const pdfOutput = doc.output('arraybuffer')

    return new NextResponse(pdfOutput, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="maintain-${period}-report-${branchName.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF Export error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
