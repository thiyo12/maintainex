import type { Metadata } from 'next'
import BookingConfirmationPage from './client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Booking Confirmation',
    robots: { index: false, follow: false },
  }
}

export default function BookingConfirmationWrapper() {
  return <BookingConfirmationPage />
}
