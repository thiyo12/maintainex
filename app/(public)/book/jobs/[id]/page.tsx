import type { Metadata } from 'next'
import JobClient from './JobClient'

export const metadata: Metadata = {
  title: 'Booking Status',
  description: 'Track your MaintainEX booking, quotes and payment status.',
  robots: { index: false, follow: false },
}

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <JobClient jobId={id} />
}
