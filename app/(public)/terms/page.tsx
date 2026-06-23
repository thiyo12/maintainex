import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service — Maintainex',
  description: 'Maintainex terms of service. Terms governing the use of the Maintainex platform.',
}

export default function TermsPage() {
  return (
    <>
      <Header />
      <WhatsAppButton />
      <main className="pt-16 min-h-screen bg-background">
        <section className="bg-foreground py-16 md:py-20">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <div className="size-14 rounded-2xl bg-amber-soft flex items-center justify-center mx-auto mb-5">
              <FileText className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-background">
              Terms of Service
            </h1>
            <p className="text-background/70 mt-3 text-sm">
              Maintainex (Pvt) Ltd / Maintainex Technologies Inc. &middot; Operating as: Maintainex
            </p>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground space-y-8">
              <div>
                <h2 className="text-xl font-bold text-ink mb-3">1. About Maintainex and These Terms</h2>
                <h3 className="font-semibold text-ink mt-4 mb-2">1.1 Who We Are</h3>
                <p>
                  Maintainex is a two-sided marketplace platform operated by Maintainex, a company incorporated and operating in both Sri Lanka and Canada. Maintainex connects individuals and businesses (&quot;Customers&quot;) who need services with skilled independent service providers (&quot;Taskers&quot;) and service companies (&quot;Companies&quot;). Maintainex also offers real estate listing services and digital service matching within its platform.
                </p>
                <div className="bg-card rounded-2xl border border-border p-5 mt-3 space-y-2">
                  <p className="text-sm"><strong className="text-ink">Sri Lanka:</strong> 56/7 New Senguntha Road, Thirunelvely, Jaffna, Sri Lanka</p>
                  <p className="text-sm"><strong className="text-ink">Canada:</strong> Vancouver, Canada</p>
                  <p className="text-sm"><strong className="text-ink">Contact:</strong> maintainex.lk@gmail.com</p>
                </div>

                <h3 className="font-semibold text-ink mt-5 mb-2">1.2 Acceptance of Terms</h3>
                <p>By downloading, accessing, or using the Maintainex platform, you confirm that you have read and understood these Terms, are at least 18 years of age, have the legal capacity to enter into a binding agreement, and agree to be bound by these Terms and our Privacy Policy.</p>

                <h3 className="font-semibold text-ink mt-5 mb-2">1.3 Changes to These Terms</h3>
                <p>We may update these Terms from time to time. When we make material changes, we will notify you via the Platform, push notification, or email at least 14 days before the changes take effect.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">2. Definitions</h2>
                <dl className="space-y-3">
                  <div><dt className="font-semibold text-ink">Platform</dt><dd className="text-sm ml-4">The Maintainex mobile application, website, APIs, and any related services or tools.</dd></div>
                  <div><dt className="font-semibold text-ink">User</dt><dd className="text-sm ml-4">Any person who accesses or uses the Platform.</dd></div>
                  <div><dt className="font-semibold text-ink">Customer</dt><dd className="text-sm ml-4">A User who posts jobs, books services, or lists real estate.</dd></div>
                  <div><dt className="font-semibold text-ink">Tasker</dt><dd className="text-sm ml-4">An independent individual service provider who offers services through the Platform.</dd></div>
                  <div><dt className="font-semibold text-ink">Company</dt><dd className="text-sm ml-4">A registered business entity that offers services through the Platform or posts job requirements.</dd></div>
                  <div><dt className="font-semibold text-ink">Service</dt><dd className="text-sm ml-4">Any task, job, or professional service offered, posted, or booked through the Platform.</dd></div>
                  <div><dt className="font-semibold text-ink">Booking</dt><dd className="text-sm ml-4">A confirmed agreement between a Customer and a Tasker or Company to perform a Service.</dd></div>
                  <div><dt className="font-semibold text-ink">Platform Fee</dt><dd className="text-sm ml-4">The service charge applied by Maintainex on transactions processed through the Platform.</dd></div>
                </dl>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">3. Eligibility and Registration</h2>
                <p>You must be at least 18 years of age to use the Platform. You agree to provide accurate information during registration, keep your credentials confidential, and accept responsibility for all activity under your account. The Platform supports Customer, Tasker, and Company account types.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">4. The Maintainex Platform</h2>
                <p>Maintainex is a technology marketplace that connects Customers with Taskers and Companies. We are not a party to any Service agreement between Users. The Platform facilitates job posting and quoting, Offer Program (instant booking), digital and remote services, real estate listings, and AI-powered search.</p>
                <p className="mt-2">Maintainex does not guarantee that a job post will receive quotes, that a Tasker will receive bookings, or that any Service will be performed to satisfaction.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">5. Tasker and Company Obligations</h2>
                <p>Taskers and Companies are independent contractors, not employees of Maintainex. They are responsible for their own taxes, licences, permits, and insurance. They must provide accurate profiles and perform all Services with reasonable care and skill.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">6. Customer Obligations</h2>
                <p>Customers must provide accurate job details, pay for Services in accordance with agreed quotes, provide a safe working environment, and treat all service providers with respect.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">7. Payments and Fees</h2>
                <p>Maintainex charges a Platform Fee on transactions, displayed clearly at checkout. Payments are processed via third-party gateways. Payouts to Taskers and Companies are released after Customer confirmation, or within 7 business days if no dispute is raised.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">8. Reviews and Ratings</h2>
                <p>After a Service, both parties may leave honest reviews. Fake, incentivized, or threatening reviews are prohibited.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">9. Disputes Between Users</h2>
                <p>Users should resolve disputes directly within 48 hours. If unresolved, either party may escalate to Maintainex mediation at maintainex.lk@gmail.com. Maintainex will provide a non-binding recommendation within 5 business days. Maintainex is not a court or arbitrator.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">10. Prohibited Uses</h2>
                <p>You must not use the Platform to violate any law, post illegal jobs, harass other users, scrape data, introduce malware, or engage in fraudulent activity.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">11. Suspension and Termination</h2>
                <p>You may close your account at any time. Maintainex may suspend or terminate your account if we believe you have breached these Terms or engaged in harmful conduct.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">12. Disclaimers and Limitation of Liability</h2>
                <p>The Platform is provided &quot;as is.&quot; To the maximum extent permitted by law, Maintainex&apos;s total aggregate liability to any User shall not exceed the greater of amounts paid in the preceding 3 months or LKR 10,000 / CAD $100.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">13. Governing Law and Dispute Resolution</h2>
                <p>These Terms are governed by the laws of Sri Lanka. For Users in Canada, Canadian federal and provincial law may also apply. Any legal proceedings shall be subject to the exclusive jurisdiction of the courts of Jaffna, Sri Lanka.</p>
                <p className="mt-2">Before initiating formal proceedings, you agree to contact maintainex.lk@gmail.com and attempt to resolve the matter informally for at least 30 days.</p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-ink mb-3">14. Contact</h2>
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
