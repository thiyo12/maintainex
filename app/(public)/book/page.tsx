import type { Metadata } from 'next'
import BookClient from './BookClient'

export const metadata: Metadata = {
  title: 'Book a Service',
  description: 'Book a MaintainEX service online using the same marketplace used by the MaintainEX app.',
  robots: { index: false, follow: true },
}

export default function BookPage() {
  return <BookClient />
}
