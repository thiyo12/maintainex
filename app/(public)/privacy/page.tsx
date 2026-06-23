import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { Shield } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — Maintainex',
  description: 'Maintainex privacy policy. Learn how we collect, use, and protect your personal information.',
}

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      <main className="pt-16 min-h-screen bg-background">
        <section className="bg-foreground py-16 md:py-20">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <div className="size-14 rounded-2xl bg-amber-soft flex items-center justify-center mx-auto mb-5">
              <Shield className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-background">
              Privacy Policy
            </h1>
            <p className="text-background/70 mt-3 text-sm">
              Effective Date: June 22, 2025 &middot; Last Updated: June 22, 2025
            </p>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground space-y-8">
              <div>
                <h2 className="text-xl font-bold text-ink mb-3">Overview</h2>
                <p>
                  Maintainex is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, store, and protect your personal information when you use the Maintainex Platform. We comply with:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>Sri Lanka:</strong> Personal Data Protection Act No. 9 of 2022 (PDPA)</li>
                  <li><strong>Canada:</strong> Personal Information Protection and Electronic Documents Act (PIPEDA) and applicable provincial privacy laws</li>
                  <li><strong>International users:</strong> GDPR-aligned data handling principles</li>
                </ul>
                <p className="mt-2">By using the Platform, you consent to the collection and use of your information as described here.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">1. Who Is Responsible for Your Data</h2>
                <p>Maintainex acts as the data controller for personal information collected through the Platform.</p>
                <div className="bg-card rounded-2xl border border-border p-5 mt-3 space-y-3">
                  <div>
                    <p className="font-semibold text-ink text-sm">Sri Lanka:</p>
                    <p className="text-sm">Maintainex (Pvt) Ltd<br />56/7 New Senguntha Road, Thirunelvely, Jaffna, Sri Lanka<br />Email: maintainex.lk@gmail.com</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm">Canada:</p>
                    <p className="text-sm">Maintainex Technologies Inc.<br />Vancouver, Canada<br />Email: maintainex.canada@gmail.com</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink text-sm">Privacy Officer:</p>
                    <p className="text-sm">Maintainex Privacy Team &mdash; maintainex.lk@gmail.com</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">2. What Personal Information We Collect</h2>
                <h3 className="font-semibold text-ink mt-4 mb-2">Information You Provide Directly</h3>
                <p><strong>Account Registration:</strong> Full name, email address, phone number, password (stored encrypted), profile photo (optional), date of birth, account type.</p>
                <p className="mt-2"><strong>Tasker / Company Profile:</strong> Skills, qualifications, certificates, business registration, bank/payment details, portfolio photos.</p>
                <p className="mt-2"><strong>Job Posts and Bookings:</strong> Job details, service address, budget, dates, photos of job site.</p>
                <p className="mt-2"><strong>Real Estate Listings:</strong> Property address, details, photos.</p>
                <p className="mt-2"><strong>Communications:</strong> In-app messages, support requests, reviews.</p>
                <p className="mt-2"><strong>Payment Information:</strong> Processed by our payment partners &mdash; Maintainex does not store full card numbers.</p>

                <h3 className="font-semibold text-ink mt-5 mb-2">Information We Collect Automatically</h3>
                <p>Device information, log data (IP address, browser type), GPS location data (with your permission), usage data, app version.</p>

                <h3 className="font-semibold text-ink mt-5 mb-2">Information From Third Parties</h3>
                <p>Payment processors, identity verification services, social login providers (Google/Apple), analytics providers.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">3. How We Use Your Personal Information</h2>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Creating and managing your account</li>
                  <li>Processing job postings, quotes, bookings, and payments</li>
                  <li>Matching Customers with Taskers and Companies</li>
                  <li>Facilitating in-app communication</li>
                  <li>Verifying identity and preventing fraud</li>
                  <li>Improving the Platform through analytics</li>
                  <li>Sending booking confirmations, reminders, and support responses</li>
                  <li>Complying with legal obligations in Sri Lanka and Canada</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">4. Location Data</h2>
                <p>Location data is central to how Maintainex operates. We use it to calculate distance between job locations and Tasker locations (using the Haversine formula), show relevant listings near you, and display approximate location on your profile.</p>
                <p className="mt-2">Location permission is optional and only used with your consent. We do not collect location data in the background when the app is closed.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">5. How We Share Your Information</h2>
                <p>We do not sell your personal information. We share it only:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>With other Users when a Booking is confirmed (name, contact, location)</li>
                  <li>With trusted service providers under strict confidentiality agreements</li>
                  <li>For legal reasons if required by law in Sri Lanka, Canada, or other jurisdictions</li>
                  <li>In a business transfer (merger, acquisition) with notice to you</li>
                  <li>With your explicit consent</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">6. International Data Transfers</h2>
                <p>We may store or process your data in Sri Lanka, Canada, or third-party cloud infrastructure. Where we transfer personal data across borders, we implement appropriate safeguards including standard contractual clauses.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">7. Data Retention</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 pr-4 font-semibold text-ink">Data Type</th>
                        <th className="text-left py-2 font-semibold text-ink">Retention Period</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr><td className="py-2 pr-4">Account information</td><td className="py-2">Duration of account + 2 years</td></tr>
                      <tr><td className="py-2 pr-4">Booking and transaction records</td><td className="py-2">7 years (tax and legal compliance)</td></tr>
                      <tr><td className="py-2 pr-4">Messages and communications</td><td className="py-2">2 years from date of message</td></tr>
                      <tr><td className="py-2 pr-4">Verification documents</td><td className="py-2">1 year after verification decision</td></tr>
                      <tr><td className="py-2 pr-4">Location data (GPS logs)</td><td className="py-2">90 days</td></tr>
                      <tr><td className="py-2 pr-4">Log data and analytics</td><td className="py-2">13 months</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">8. Cookies and Tracking</h2>
                <p>The Platform uses strictly necessary, functional, analytics, and marketing cookies (marketing only with consent). You can control cookies through your browser settings.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">9. Security</h2>
                <p>We implement encryption in transit (TLS), encryption at rest (AES-256), access controls, security monitoring, and regular penetration testing. No system is entirely secure &mdash; please protect your account with a strong password.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">10. Your Rights</h2>
                <p><strong>Sri Lanka (PDPA):</strong> Right to access, correction, erasure, withdraw consent, and complain to the Data Protection Authority of Sri Lanka.</p>
                <p className="mt-2"><strong>Canada (PIPEDA):</strong> Right to access, correction, and complain to the Office of the Privacy Commissioner of Canada.</p>
                <p className="mt-2"><strong>International (GDPR-aligned):</strong> Right to data portability, restriction of processing, object to processing, and not be subject to fully automated decision-making.</p>
                <p className="mt-4">To exercise your rights, email maintainex.lk@gmail.com with subject line &quot;Privacy Rights Request.&quot; We will respond within 30 days.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">11. Contact Us</h2>
                <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
                  <p className="text-sm"><strong className="text-ink">Email:</strong> maintainex.lk@gmail.com</p>
                  <p className="text-sm"><strong className="text-ink">Sri Lanka:</strong> 56/7 New Senguntha Road, Thirunelvely, Jaffna, Sri Lanka</p>
                  <p className="text-sm"><strong className="text-ink">Canada:</strong> Vancouver, Canada</p>
                </div>
                <p className="mt-4 text-sm">&copy; 2026 Maintainex. All rights reserved.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
