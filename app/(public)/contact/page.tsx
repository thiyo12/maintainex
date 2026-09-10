import type { Metadata } from 'next'
import ContactPage from './client'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Contact Us',
    description: `Get in touch with MaintainEX. Call, email, or visit our Jaffna headquarters. We're here to help with all your home service needs.`,
    alternates: { canonical: 'https://maintainex.lk/contact' },
    openGraph: {
      title: `Contact MaintainEX`,
      description: `Reach out to MaintainEX for inquiries, app support, or partnership.`,
    },
  }
}

export default function ContactPageWrapper() {
  return <ContactPage />
}
