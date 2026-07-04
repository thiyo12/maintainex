import { prisma } from './prisma'
import { getSetting } from './settings'
import { haversineKm } from './distance'
import { createNotification } from './notifications'

/**
 * Called when a customer confirms an offer booking.
 * Finds the best enrolled tasker and notifies them.
 */
export async function matchOfferBooking(bookingId: string): Promise<{ matched: boolean }> {
  const booking = await prisma.offerBooking.findUnique({
    where: { id: bookingId },
    include: { template: true },
  })
  if (!booking) throw new Error('Booking not found')

  const radiusKm = await getSetting('matching.radius_km', 50)
  const maxActive = await getSetting('matching.max_active_jobs', 3)

  // Get all enrolled taskers for this template
  const enrollments = await prisma.offerEnrollment.findMany({
    where: { templateId: booking.templateId, status: 'active' },
    include: {
      tasker: {
        include: {
          user: { select: { id: true, name: true, pushToken: true, isSuspended: true } },
        },
      },
    },
  })

  let pool = enrollments
    .map(e => ({
      enrollmentId: e.id,
      userId: e.tasker.userId,
      name: e.tasker.user.name || 'Unknown',
      pushToken: e.tasker.user.pushToken,
      latitude: e.tasker.latitude,
      longitude: e.tasker.longitude,
      compositeScore: e.tasker.compositeScore ?? 0,
      isSuspended: e.tasker.user.isSuspended,
    }))
    .filter(t => !t.isSuspended)

  // Filter by distance
  const bLat = booking.latitude
  const bLng = booking.longitude
  if (bLat != null && bLng != null) {
    pool = pool.filter(t => {
      if (!t.latitude || !t.longitude) return false
      const dist = haversineKm(bLat, bLng, t.latitude, t.longitude)
      return dist <= radiusKm
    })
  }

  if (pool.length === 0) {
    await prisma.offerBooking.update({
      where: { id: bookingId },
      data: { status: 'no_tasker_available' },
    })
    await createNotification({
      userId: booking.customerId,
      title: 'No taskers available',
      body: 'All taskers are busy. Try posting a job to get custom quotes.',
    })
    return { matched: false }
  }

  // Sort by composite score descending
  pool.sort((a, b) => b.compositeScore - a.compositeScore)

  // Build offer match queue
  await prisma.offerMatchQueue.deleteMany({ where: { bookingId } })
  for (let i = 0; i < pool.length; i++) {
    await prisma.offerMatchQueue.create({
      data: {
        bookingId,
        taskerId: pool[i].userId,
        score: pool[i].compositeScore,
        rank: i + 1,
        status: 'pending',
      },
    })
  }

  // Notify the top candidate
  await notifyNextOfferCandidate(bookingId)
  return { matched: true }
}

export async function notifyNextOfferCandidate(bookingId: string): Promise<void> {
  const candidate = await prisma.offerMatchQueue.findFirst({
    where: { bookingId, status: 'pending' },
    orderBy: { rank: 'asc' },
    include: {
      tasker: { include: { user: { select: { pushToken: true, name: true } } } },
      booking: { include: { template: { select: { title: true, priceLkr: true } } } },
    },
  })

  if (!candidate) {
    const booking = await prisma.offerBooking.findUnique({ where: { id: bookingId } })
    if (booking) {
      await createNotification({
        userId: booking.customerId,
        title: 'No taskers available',
        body: 'All taskers are busy. Try posting a job to get custom quotes.',
      })
      await prisma.offerBooking.update({
        where: { id: bookingId },
        data: { status: 'no_tasker_available' },
      })
    }
    return
  }

  const timeoutMin = await getSetting('offer.accept_timeout_min', 15)

  await prisma.offerMatchQueue.update({
    where: { bookingId_taskerId: { bookingId, taskerId: candidate.taskerId } },
    data: {
      status: 'notified',
      notifiedAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMin * 60 * 1000),
    },
  })

  await prisma.offerBooking.update({
    where: { id: bookingId },
    data: { status: 'finding', currentTaskerId: candidate.taskerId },
  })

  if (candidate.tasker.user.pushToken) {
    await createNotification({
      userId: candidate.taskerId,
      title: 'Instant Booking Request',
      body: `${candidate.booking.template.title} — LKR ${candidate.booking.template.priceLkr.toLocaleString()} · Accept in ${timeoutMin} min`,
      referenceType: 'OFFER_BOOKING',
      referenceId: bookingId,
    })
  }
}

export async function taskerRespondToOffer(bookingId: string, taskerId: string, accepted: boolean): Promise<void> {
  await prisma.offerMatchQueue.update({
    where: { bookingId_taskerId: { bookingId, taskerId } },
    data: { status: accepted ? 'accepted' : 'declined', respondedAt: new Date() },
  })

  if (accepted) {
    await prisma.offerBooking.update({
      where: { id: bookingId },
      data: { status: 'accepted', taskerId },
    })

    const booking = await prisma.offerBooking.findUnique({
      where: { id: bookingId },
      include: {
        template: { select: { title: true } },
      },
    })

    await createNotification({
      userId: booking!.customerId,
      title: 'Tasker Found!',
      body: `A tasker has accepted your booking for "${booking!.template.title}".`,
      referenceType: 'OFFER_ACCEPTED',
      referenceId: bookingId,
    })
  } else {
    // Move to next candidate
    await notifyNextOfferCandidate(bookingId)
  }
}
