import type { Metadata } from 'next'
import Client from './client'

export const metadata: Metadata = {
  title: 'MaintainEX — Connect with Professionals Who Get the Job Done',
  description:
    'Connect with verified professionals for any task — home, business, or local. 10% platform fee. AI-powered matching. Sri Lanka & Canada.',
}

export default function HomePage() {
  return <Client />
}
