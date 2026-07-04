import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    const results: Record<string, number> = {}

    // 1. PlatformSettings — ensure it exists
    const existingSettings = await prisma.platformSettings.count()
    if (existingSettings === 0) {
      await prisma.platformSettings.create({
        data: {
          platformFeeBps: 1000,
          minJobAmountCents: 500,
          maxJobAmountCents: 1000000,
          escrowReleaseDays: 3,
          maxActiveJobsPerUser: 10,
          maxQuotesPerJob: 10,
          maxDisputesPerJob: 1,
          autoReleaseAfterDays: 14,
          supportEmail: 'support@maintainex.lk',
        },
      })
      results.platformSettings = 1
    }

    // 2. Users — ensure at least 10 test users exist
    const userCount = await prisma.user.count()
    if (userCount < 10) {
      const testUsers = [
        { email: 'john@example.com', name: 'John Silva', role: 'CUSTOMER', phone: '+94770000001' },
        { email: 'sarah@example.com', name: 'Sarah Perera', role: 'CUSTOMER', phone: '+94770000002' },
        { email: 'mike@example.com', name: 'Mike Fernando', role: 'TASKER', phone: '+94770000003' },
        { email: 'anna@example.com', name: 'Anna De Silva', role: 'CUSTOMER', phone: '+94770000004' },
        { email: 'david@example.com', name: 'David Rajan', role: 'TASKER', phone: '+94770000005' },
        { email: 'priya@example.com', name: 'Priya Kumar', role: 'CUSTOMER', phone: '+94770000006' },
        { email: 'tom@example.com', name: 'Tom Wickram', role: 'TASKER', phone: '+94770000007' },
        { email: 'nina@example.com', name: 'Nina Jayawardena', role: 'CUSTOMER', phone: '+94770000008' },
        { email: 'alex@example.com', name: 'Alex Guna', role: 'CUSTOMER', phone: '+94770000009' },
        { email: 'lisa@example.com', name: 'Lisa Mendis', role: 'TASKER', phone: '+94770000010' },
      ]
      let created = 0
      for (const u of testUsers) {
        const exists = await prisma.user.findUnique({ where: { email: u.email } })
        if (!exists) {
          await prisma.user.create({
            data: {
              ...u,
              passwordHash: '$2b$12$LJ3m4ys3Lg3YOCwKkYqOYe3Qj6sF5gHJkLmNpRqTsUvWxZ8yB7Ae', // Test123!
              isActive: true,
              identityStatus: u.role === 'TASKER' ? 'APPROVED' : 'NOT_SUBMITTED',
            },
          })
          // Create TaskerProfile if TASKER
          if (u.role === 'TASKER') {
            const user = await prisma.user.findUnique({ where: { email: u.email } })
            if (user && !(await prisma.taskerProfile.findUnique({ where: { userId: user.id } }))) {
              await prisma.taskerProfile.create({
                data: {
                  userId: user.id,
                  bio: `Experienced ${u.name.split(' ')[0]} providing quality service`,
                  hourlyRate: Math.floor(Math.random() * 5000) + 500,
                  skills: '["cleaning","plumbing","electrical"]',
                  serviceAreas: '["Colombo","Kandy","Galle"]',
                  rating: Math.floor(Math.random() * 20 + 30) / 10,
                  completedJobs: Math.floor(Math.random() * 100),
                  isVerified: true,
                  compositeScore: Math.random() * 100,
                  penaltyPoints: 0,
                  completionRate: 95 + Math.random() * 5,
                  avgResponseMin: Math.floor(Math.random() * 10 + 1),
                },
              })
            }
          }
          created++
        }
      }
      results.usersCreated = created
    }

    // 3. AdminUsers — ensure at least 2 additional staff
    const adminCount = await prisma.adminUser.count()
    if (adminCount < 3) {
      const staff = [
        { email: 'moderator@maintainex.com', firstName: 'Mod', lastName: 'Erator', role: 'MODERATOR', assignedCountries: 'LK' },
        { email: 'support@maintainex.com', firstName: 'Sup', lastName: 'Port', role: 'SUPPORT', assignedCountries: 'LK,CA' },
      ]
      let created = 0
      for (const s of staff) {
        const exists = await prisma.adminUser.findUnique({ where: { email: s.email } })
        if (!exists) {
          await prisma.adminUser.create({
            data: {
              ...s,
              passwordHash: '$2b$12$LJ3m4ys3Lg3YOCwKkYqOYe3Qj6sF5gHJkLmNpRqTsUvWxZ8yB7Ae',
              isActive: true,
            },
          })
          created++
        }
      }
      results.staffCreated = created
    }

    // 4. MarketplaceJob — ensure at least 20 jobs exist
    const jobCount = await prisma.marketplaceJob.count()
    if (jobCount < 20) {
      const users = await prisma.user.findMany({ take: 10 })
      const categories = await prisma.category.findMany({ take: 5 })
      const jobTemplates = [
        { title: 'Deep House Cleaning - 3BR', budgetType: 'FIXED', budgetAmount: 500000, urgency: 'normal', description: 'Need thorough cleaning of 3 bedroom house including windows, kitchen, and bathrooms.' },
        { title: 'Leaky Kitchen Faucet Repair', budgetType: 'FIXED', budgetAmount: 150000, urgency: 'urgent', description: 'Kitchen faucet is leaking continuously need immediate repair.' },
        { title: 'Full House Electrical Rewiring', budgetType: 'REQUEST_QUOTES', budgetAmount: 2000000, urgency: 'normal', description: 'Old house needs complete electrical rewiring for safety.' },
        { title: 'AC Installation - Split Unit', budgetType: 'FIXED', budgetAmount: 350000, urgency: 'normal', description: 'Need to install a 2.5 ton split AC unit in living room.' },
        { title: 'Garden Landscaping & Design', budgetType: 'NEGOTIABLE', budgetAmount: 750000, urgency: 'normal', description: 'Front garden needs complete landscaping with plants and pathways.' },
        { title: 'Emergency Pipe Burst', budgetType: 'FIXED', budgetAmount: 250000, urgency: 'emergency', description: 'Main water pipe burst in basement! Need immediate plumber.' },
        { title: 'Office Painting - 2000sqft', budgetType: 'REQUEST_QUOTES', budgetAmount: 400000, urgency: 'normal', description: 'Commercial office space needs repainting before new tenant moves in.' },
        { title: 'Smart Home Installation', budgetType: 'FIXED', budgetAmount: 180000, urgency: 'normal', description: 'Install smart switches, cameras, and door lock system.' },
        { title: 'Sofa Reupholstering', budgetType: 'FIXED', budgetAmount: 85000, urgency: 'normal', description: '3-seater fabric sofa needs reupholstering with new fabric.' },
        { title: 'Water Tank Cleaning', budgetType: 'FIXED', budgetAmount: 45000, urgency: 'normal', description: 'Overhead water tank needs cleaning and disinfection.' },
        { title: 'Roof Leak Repair', budgetType: 'FIXED', budgetAmount: 120000, urgency: 'urgent', description: 'Roof leaking during rain season needs immediate repair.' },
        { title: 'Window Replacement - 5 Windows', budgetType: 'REQUEST_QUOTES', budgetAmount: 600000, urgency: 'normal', description: 'Replace old wooden windows with new aluminum frames.' },
        { title: 'Pool Cleaning & Maintenance', budgetType: 'HOURLY', budgetAmount: 30000, urgency: 'normal', description: 'Weekly pool cleaning service needed for residential pool.' },
        { title: 'Furniture Assembly - IKEA', budgetType: 'FIXED', budgetAmount: 25000, urgency: 'normal', description: 'Need help assembling multiple IKEA furniture items.' },
        { title: 'Tile Flooring Installation', budgetType: 'FIXED', budgetAmount: 350000, urgency: 'normal', description: 'Install ceramic tile flooring in living and dining area.' },
        { title: 'Pest Control Treatment', budgetType: 'FIXED', budgetAmount: 55000, urgency: 'normal', description: 'General pest control treatment for termites and cockroaches.' },
        { title: 'Solar Panel Installation', budgetType: 'REQUEST_QUOTES', budgetAmount: 1500000, urgency: 'normal', description: 'Install 3kW solar panel system on residential roof.' },
        { title: 'Car Detailing Service', budgetType: 'FIXED', budgetAmount: 35000, urgency: 'normal', description: 'Complete interior and exterior car detailing service.' },
        { title: 'CCTV Camera Installation', budgetType: 'FIXED', budgetAmount: 95000, urgency: 'normal', description: 'Install 4 camera CCTV system with DVR for home security.' },
        { title: 'Bathroom Renovation', budgetType: 'REQUEST_QUOTES', budgetAmount: 800000, urgency: 'normal', description: 'Complete bathroom renovation including tiles, fixtures, and plumbing.' },
        { title: 'Generator Service & Repair', budgetType: 'FIXED', budgetAmount: 65000, urgency: 'urgent', description: 'Backup generator not starting need service urgently.' },
        { title: 'False Ceiling Installation', budgetType: 'FIXED', budgetAmount: 200000, urgency: 'normal', description: 'Install gypsum false ceiling in living room with LED lighting.' },
        { title: 'Water Pump Installation', budgetType: 'FIXED', budgetAmount: 45000, urgency: 'normal', description: 'Install new water pressure pump for multi-story house.' },
        { title: 'Mosquito Net Installation', budgetType: 'FIXED', budgetAmount: 15000, urgency: 'normal', description: 'Install mosquito nets on 8 windows and 2 doors.' },
        { title: 'Wooden Deck Construction', budgetType: 'NEGOTIABLE', budgetAmount: 500000, urgency: 'normal', description: 'Build wooden deck in backyard for outdoor entertaining.' },
      ]
      const statuses = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
      let created = 0
      for (const job of jobTemplates.slice(0, 25)) {
        const customer = users[created % users.length]
        const cat = categories[created % categories.length]
        await prisma.marketplaceJob.create({
          data: {
            customerId: customer.id,
            title: job.title,
            description: job.description,
            categoryId: cat?.id || 'uncategorized',
            photos: '[]',
            budgetType: job.budgetType,
            budgetAmount: BigInt(job.budgetAmount),
            urgency: job.urgency,
            status: statuses[created % statuses.length],
            workersCount: Math.floor(Math.random() * 3) + 1,
            estimatedDuration: Math.floor(Math.random() * 48) + 2,
          },
        })
        created++
      }
      results.jobsCreated = created
    }

    // 5. JobEscrow — ensure at least 8 escrows exist
    const escrowCount = await prisma.jobEscrow.count()
    if (escrowCount < 8) {
      const completedJobs = await prisma.marketplaceJob.findMany({ where: { status: { in: ['IN_PROGRESS', 'COMPLETED'] } }, take: 10 })
      const users = await prisma.user.findMany({ take: 10 })
      const statuses = ['PROTECTED', 'ON_HOLD', 'RELEASED', 'REFUNDED']
      let created = 0
      for (let i = 0; i < Math.min(10, completedJobs.length); i++) {
        const job = completedJobs[i]
        const provider = users[(i + 2) % users.length]
        const status = statuses[i % statuses.length]
        const amount = job.budgetAmount
        const serviceFee = BigInt(Math.floor(Number(amount) * 0.1))
        const now = new Date()
        await prisma.jobEscrow.create({
          data: {
            jobId: job.id,
            quoteId: `seed-quote-${i}`,
            customerId: job.customerId,
            providerId: provider.id,
            amount,
            serviceFee,
            totalAmount: BigInt(Number(amount) + Number(serviceFee)),
            paymentMethod: i % 3 === 0 ? 'CASH' : 'CARD',
            status,
            heldAt: status !== 'PENDING' ? new Date(now.getTime() - Math.random() * 7 * 86400000) : null,
            releasedAt: status === 'RELEASED' ? new Date(now.getTime() - Math.random() * 3 * 86400000) : null,
            refundedAt: status === 'REFUNDED' ? new Date(now.getTime() - Math.random() * 2 * 86400000) : null,
          },
        })
        created++
      }
      results.escrowsCreated = created
    }

    // 6. WalletTransaction — ensure at least 15 revenue transactions
    const txCount = await prisma.walletTransaction.count()
    if (txCount < 15) {
      const users = await prisma.user.findMany({ take: 10 })
      const types = ['CREDIT', 'DEBIT']
      const refTypes = ['ESCROW_RELEASE', 'SERVICE_FEE', 'WITHDRAWAL']
      let created = 0
      for (let i = 0; i < 20; i++) {
        const user = users[i % users.length]
        const type = types[i % 2]
        const refType = refTypes[i % refTypes.length]
        const amount = Math.floor(Math.random() * 50000) + 1000
        const balBefore = Math.floor(Math.random() * 100000)
        await prisma.walletTransaction.create({
          data: {
            userId: user.id,
            walletType: i % 2 === 0 ? 'PROVIDER' : 'CUSTOMER',
            type,
            amount,
            balanceBefore: balBefore,
            balanceAfter: type === 'CREDIT' ? balBefore + amount : balBefore - amount,
            reference: `${refType}-${i}`,
            referenceType: refType,
            status: 'COMPLETED',
            createdAt: new Date(Date.now() - i * 86400000),
          },
        })
        created++
      }
      results.transactionsCreated = created
    }

    // 7. OfferTemplate — ensure at least 10 offers exist
    const offerCount = await prisma.offerTemplate.count()
    if (offerCount < 10) {
      const categories = await prisma.category.findMany({ take: 5 })
      const offers = [
        { title: 'Basic House Cleaning', priceLkr: 2500, scopeNotes: '2 BHK apartment, includes kitchen & bathrooms' },
        { title: 'Deep Cleaning Package', priceLkr: 8500, scopeNotes: 'Full house deep cleaning, 4 BHK, all rooms' },
        { title: 'Plumbing Checkup', priceLkr: 1500, scopeNotes: 'Basic inspection of all plumbing fixtures' },
        { title: 'Electrical Safety Check', priceLkr: 2000, scopeNotes: 'Full house electrical inspection report' },
        { title: 'AC Servicing', priceLkr: 3500, scopeNotes: 'Clean filters, check gas, optimize performance' },
        { title: 'Garden Maintenance', priceLkr: 3000, scopeNotes: 'Lawn mowing, hedge trimming, weed removal' },
        { title: 'Painting - Single Room', priceLkr: 12000, scopeNotes: 'Includes paint materials and labor' },
        { title: 'Pest Control Basic', priceLkr: 4500, scopeNotes: 'General pest treatment for apartment' },
        { title: 'Furniture Assembly', priceLkr: 2000, scopeNotes: 'Per item, standard furniture assembly' },
        { title: 'Water Purifier Service', priceLkr: 800, scopeNotes: 'Filter replacement and system check' },
        { title: 'CCTV Installation Basic', priceLkr: 15000, scopeNotes: '2 cameras with DVR, basic setup' },
        { title: 'Solar Panel Cleaning', priceLkr: 5000, scopeNotes: 'Clean and optimize solar panel efficiency' },
      ]
      let created = 0
      for (const offer of offers) {
        const cat = categories[created % categories.length]
        await prisma.offerTemplate.create({
          data: {
            categoryId: cat?.id || 'uncategorized',
            title: offer.title,
            description: `${offer.title} service offered by verified professionals. ${offer.scopeNotes}`,
            priceLkr: offer.priceLkr,
            scopeNotes: offer.scopeNotes,
            isRemote: false,
            availabilityLabel: 'Today',
            isFeatured: created < 4,
            isActive: true,
          },
        })
        created++
      }
      results.offersCreated = created
    }

    // 8. AdminAlert — ensure at least 10 alerts exist
    const alertCount = await prisma.adminAlert.count()
    if (alertCount < 10) {
      const alerts = [
        { type: 'fraud', severity: 'high', title: 'Suspicious Login Pattern Detected', description: 'Multiple failed login attempts from different IPs for user john@example.com' },
        { type: 'dispute', severity: 'critical', title: 'Escrow Dispute Raised', description: 'Customer disputing job completion quality for job #JOB-001' },
        { type: 'payout', severity: 'medium', title: 'Large Payout Pending Approval', description: 'Payout of LKR 250,000 pending for user mike@example.com' },
        { type: 'system', severity: 'low', title: 'Database Backup Completed', description: 'Routine nightly backup completed successfully' },
        { type: 'fraud', severity: 'critical', title: 'Chargeback Alert', description: 'Credit card chargeback received for transaction TX-2024-001' },
        { type: 'dispute', severity: 'high', title: 'Provider Complaint', description: 'Provider reporting non-payment for completed job #JOB-002' },
        { type: 'payout', severity: 'high', title: 'International Payout', description: 'Cross-border payout to Canadian provider needs review' },
        { type: 'system', severity: 'medium', title: 'API Rate Limit Warning', description: 'API rate limit at 85% capacity for endpoint /api/marketplace/jobs' },
        { type: 'fraud', severity: 'medium', title: 'Multiple Account Detection', description: 'User linked to 3 accounts with same IP address' },
        { type: 'dispute', severity: 'medium', title: 'Refund Request', description: 'Customer requesting refund for cancelled job #JOB-003' },
        { type: 'system', severity: 'low', title: 'New Provider Registration', description: '10 new providers registered in the last 24 hours' },
        { type: 'payout', severity: 'low', title: 'Weekly Settlement Complete', description: 'Weekly provider settlement processed successfully' },
      ]
      let created = 0
      for (const alert of alerts) {
        await prisma.adminAlert.create({
          data: {
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            status: created < 4 ? 'open' : created < 8 ? 'in_progress' : 'resolved',
            slaMinutes: alert.severity === 'critical' ? 60 : alert.severity === 'high' ? 240 : 1440,
          },
        })
        created++
      }
      results.alertsCreated = created
    }

    // 9. AuditLog — ensure at least 20 audit logs exist
    const auditCount = await prisma.auditLog.count()
    if (auditCount < 20) {
      const admins = await prisma.adminUser.findMany({ take: 3 })
      const actions = [
        'USER_LOGIN', 'USER_CREATED', 'JOB_CREATED', 'JOB_UPDATED', 'ESCROW_RELEASED',
        'ESCROW_REFUNDED', 'ADMIN_LOGIN', 'SETTINGS_UPDATED', 'FLAG_REVIEWED', 'ALERT_RESOLVED',
        'DISPUTE_RESOLVED', 'REVIEW_MODERATED', 'OFFER_CREATED', 'OFFER_UPDATED', 'PROPERTY_APPROVED',
        'PROPERTY_REJECTED', 'USER_SUSPENDED', 'USER_ACTIVATED', 'PASSWORD_RESET', 'BACKUP_COMPLETED',
      ]
      let created = 0
      for (let i = 0; i < 25; i++) {
        const admin = admins[created % admins.length]
        await prisma.auditLog.create({
          data: {
            adminUserId: admin.id,
            adminEmail: admin.email,
            adminRole: admin.role,
            action: actions[i % actions.length],
            targetTable: i % 2 === 0 ? 'User' : i % 3 === 0 ? 'MarketplaceJob' : 'AdminAlert',
            targetId: `seed-${i}`,
            targetLabel: `Seed record ${i}`,
            oldValue: null,
            newValue: JSON.stringify({ seededAt: new Date().toISOString() }),
            ipAddress: '127.0.0.1',
            userAgent: 'Seed-Script/1.0',
            createdAt: new Date(Date.now() - i * 3600000),
          },
        })
        created++
      }
      results.auditLogsCreated = created
    }

    // 10. AdminNotification — ensure at least 10 notifications exist
    const notifCount = await prisma.adminNotification.count()
    if (notifCount < 10) {
      const admins = await prisma.adminUser.findMany({ take: 3 })
      const notifs = [
        { type: 'alert', title: 'New Fraud Alert', message: 'Suspicious activity detected from IP 192.168.1.100', link: '/admin/marketplace/alerts' },
        { type: 'info', title: 'New User Registered', message: '10 new users registered in the last hour', link: '/admin/marketplace/users' },
        { type: 'warning', title: 'Escrow Release Pending', message: '3 escrow releases awaiting confirmation', link: '/admin/marketplace/escrow' },
        { type: 'success', title: 'Backup Complete', message: 'Database backup completed successfully', link: null },
        { type: 'info', title: 'Dispute Resolved', message: 'Dispute #DSP-005 has been resolved', link: '/admin/marketplace/disputes' },
        { type: 'alert', title: 'System Performance Alert', message: 'CPU usage at 87% on production server', link: '/admin/marketplace/alerts' },
        { type: 'info', title: 'New Review Flagged', message: 'A review has been flagged for moderation', link: '/admin/marketplace/reviews' },
        { type: 'warning', title: 'Payout Queue Growing', message: '25 payouts pending in the queue', link: '/admin/marketplace/alerts' },
        { type: 'success', title: 'Offer Template Approved', message: 'New offer template has been published', link: '/admin/marketplace/offers' },
        { type: 'info', title: 'Weekly Report Ready', message: 'Weekly analytics report is now available', link: '/admin/marketplace/dashboard' },
        { type: 'alert', title: 'API Key Expiring', message: 'API key for integration will expire in 7 days', link: '/admin/marketplace/settings' },
        { type: 'info', title: 'Property Listing Approved', message: '5 property listings were approved today', link: '/admin/marketplace/properties' },
      ]
      let created = 0
      for (const notif of notifs) {
        const admin = admins[created % admins.length]
        await prisma.adminNotification.create({
          data: {
            adminUserId: admin.id,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            link: notif.link,
            read: created < 4,
          },
        })
        created++
      }
      results.notificationsCreated = created
    }

    // 11. Dispute — ensure at least 5 disputes
    const disputeCount = await prisma.dispute.count()
    if (disputeCount < 5) {
      const jobPostings = await prisma.jobPosting.findMany({ take: 5 })
      const users = await prisma.user.findMany({ take: 5 })
      if (jobPostings.length > 0 && users.length > 0) {
        let created = 0
        const reasons = [
          { reason: 'Service not completed', description: 'Provider did not finish the job as agreed.' },
          { reason: 'Poor quality work', description: 'The quality of work is below acceptable standards.' },
          { reason: 'Overcharging', description: 'Provider charged more than the agreed amount.' },
          { reason: 'Late delivery', description: 'Job was completed 3 days after the deadline.' },
          { reason: 'Damaged property', description: 'Provider caused damage to property during service.' },
        ]
        for (let i = 0; i < Math.min(5, jobPostings.length); i++) {
          const r = reasons[i]
          await prisma.dispute.create({
            data: {
              jobId: jobPostings[i].id,
              raisedById: jobPostings[i].customerId,
              reason: r.reason,
              description: r.description,
              status: i < 2 ? 'OPEN' : i < 3 ? 'UNDER_REVIEW' : 'RESOLVED',
              createdAt: new Date(Date.now() - i * 86400000),
            },
          })
          created++
        }
        results.disputesCreated = created
      }
    }

    // 12. AdminFlag / FraudEvent — ensure at least 5 flags
    const flagCount = await prisma.adminFlag.count()
    if (flagCount < 5) {
      const users = await prisma.user.findMany({ take: 10 })
      const flagReasons = [
        { reason: 'Suspicious login activity from multiple countries', notes: 'User logged in from LK, CA, and US within 1 hour' },
        { reason: 'Chargeback filed on previous transactions', notes: 'User filed 3 chargebacks in the last 30 days' },
        { reason: 'Fake identity documents submitted', notes: 'Submitted passport appears to be digitally altered' },
        { reason: 'Multiple accounts detected', notes: 'User linked to 2 other accounts with same phone number' },
        { reason: 'Unusual job posting pattern', notes: 'Posted 15 jobs in 24 hours with identical descriptions' },
        { reason: 'Suspicious payment method', notes: 'Credit card declined 5 times, different cards used' },
      ]
      let created = 0
      for (const f of flagReasons.slice(0, 5)) {
        const user = users[created % users.length]
        await prisma.adminFlag.create({
          data: {
            userId: user.id,
            reason: f.reason,
            status: created < 2 ? 'pending' : created < 4 ? 'reviewed' : 'resolved',
            notes: f.notes,
          },
        })
        // Also create fraud event
        await prisma.fraudEvent.create({
          data: {
            userId: user.id,
            type: 'MANUAL_FLAG',
            detail: f.reason,
          },
        })
        created++
      }
      results.flagsCreated = created
    }

    // 13. Review — ensure at least 10 reviews exist
    const reviewCount = await prisma.review.count()
    if (reviewCount < 10) {
      const users = await prisma.user.findMany({ take: 10 })
      const services = await prisma.service.findMany({ take: 5 })
      const statuses = ['PENDING', 'APPROVED', 'REJECTED']
      const comments = [
        'Excellent service! Very professional and on time.',
        'Good work but took longer than expected.',
        'Very satisfied with the quality. Will hire again.',
        'Average service, room for improvement.',
        'Outstanding! Exceeded my expectations.',
        'Fair price for the quality provided.',
        'Would recommend to friends and family.',
        'Not great, left a mess after work.',
        'Professional and courteous staff.',
        'Decent work for the price paid.',
        'Amazing attention to detail!',
        'Quick response and great communication.',
      ]
      let created = 0
      for (let i = 0; i < 12; i++) {
        const user = users[created % users.length]
        const service = services[created % services.length]
        const existing = await prisma.review.findFirst({ where: { userId: user.id, serviceId: service?.id || '' } })
        if (!existing && service) {
          await prisma.review.create({
            data: {
              userId: user.id,
              serviceId: service.id,
              rating: Math.floor(Math.random() * 5) + 1,
              comment: comments[created % comments.length],
              status: statuses[created % statuses.length],
              customerName: user.name,
              createdAt: new Date(Date.now() - created * 86400000),
            },
          })
          created++
        }
      }
      results.reviewsCreated = created
    }

    // 14. JobPosting — ensure at least 5 job postings exist (for Dispute model relation)
    const postingCount = await prisma.jobPosting.count()
    if (postingCount < 5) {
      const users = await prisma.user.findMany({ take: 5 })
      const titles = [
        'Need a plumber for bathroom repair',
        'Looking for electrician for wiring',
        'House cleaning service required',
        'AC repair and maintenance',
        'Garden maintenance needed',
        'Painting job for living room',
      ]
      let created = 0
      for (let i = 0; i < Math.min(5, titles.length); i++) {
        const user = users[created % users.length]
        await prisma.jobPosting.create({
          data: {
            customerId: user.id,
            title: titles[i],
            description: `Need professional service for ${titles[i].toLowerCase()}. Please quote your best price.`,
            category: 'general',
            budget: Math.floor(Math.random() * 50000) + 5000,
            location: 'Colombo',
            status: created < 3 ? 'COMPLETED' : 'OPEN',
          },
        })
        created++
      }
      results.jobPostingsCreated = created
    }

    return NextResponse.json({
      success: true,
      message: 'Test data seeded successfully',
      results,
      counts: {
        users: await prisma.user.count(),
        jobs: await prisma.marketplaceJob.count(),
        escrows: await prisma.jobEscrow.count(),
        transactions: await prisma.walletTransaction.count(),
        offers: await prisma.offerTemplate.count(),
        alerts: await prisma.adminAlert.count(),
        auditLogs: await prisma.auditLog.count(),
        notifications: await prisma.adminNotification.count(),
        disputes: await prisma.dispute.count(),
        flags: await prisma.adminFlag.count(),
        reviews: await prisma.review.count(),
        jobPostings: await prisma.jobPosting.count(),
        admins: await prisma.adminUser.count(),
      },
    })
  } catch (error: any) {
    console.error('Seed test data error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to seed test data' }, { status: 500 })
  }
}
