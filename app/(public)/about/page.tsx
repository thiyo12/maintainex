import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Script from 'next/script'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import IndustriesCarousel from '@/components/ui/IndustriesCarousel'
import { REGIONS, getRegionFromHost } from '@/lib/regions'
import { breadcrumbSchema, localBusinessSchema, faqSchema, organizationSchema } from '@/lib/seo'
import { Sparkles, Building2, Wrench, Trees, ShieldCheck, Briefcase, Users, UserCheck, Star, Calendar, LayoutDashboard, ThumbsUp, MapPin, Phone, Mail, CheckCircle2, HardHat } from 'lucide-react'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const c = REGIONS[regionKey].countryName
  const cp = REGIONS[regionKey].countryNamePossessive
  const baseUrl = regionKey === 'CA' ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'
  return {
    title: `About Maintainex — All Services Under One Roof in ${c}`,
    description: `${cp} trusted platform for cleaning, construction, maintenance, pest control & landscaping by insured professionals. Serving Jaffna, Colombo, Toronto & more.`,
    alternates: { canonical: `${baseUrl}/about` },
    openGraph: {
      title: `About Maintainex — All Services Under One Roof in ${c}`,
      description: `All property services under one roof. ${c}'s trusted platform for cleaning, construction, maintenance & more.`,
    },
  }
}

const servicesList = [
  { icon: Sparkles, title: 'Home Cleaning', desc: 'Regular cleaning, deep cleaning, move-in/move-out. Trained professionals with eco-friendly products.', slug: 'home-cleaning' },
  { icon: Building2, title: 'Office Cleaning', desc: 'Commercial cleaning for offices, retail spaces, and warehouses. Daily, weekly, or custom schedules.', slug: 'office-cleaning' },
  { icon: Wrench, title: 'Maintenance & Repairs', desc: 'Plumbing, electrical, carpentry, and general repairs. Fast response by skilled technicians.', slug: 'maintenance' },
  { icon: HardHat, title: 'Construction & Renovation', desc: 'Post-construction cleanup, renovations, painting, and site preparation for residential and commercial projects.', slug: 'post-construction' },
  { icon: Trees, title: 'Landscaping & Garden', desc: 'Garden maintenance, lawn care, tree trimming, and outdoor space design. Keep your property beautiful year-round.', slug: 'landscaping' },
  { icon: ShieldCheck, title: 'Pest Control', desc: 'Residential and commercial pest control. Safe, effective treatments for ants, termites, rodents, and more.', slug: 'pest-control' },
]

const whyChooseUs = [
  { icon: ShieldCheck, title: 'Verified & Insured Professionals', desc: 'Every team member is background-checked, trained, and fully insured for your peace of mind.' },
  { icon: Calendar, title: 'Flexible Scheduling', desc: 'Book online anytime. Morning, afternoon, or weekend — we work around your schedule.' },
  { icon: LayoutDashboard, title: 'All Services, One Booking', desc: 'From cleaning to construction, book every property service through a single platform. No more calling around.' },
  { icon: ThumbsUp, title: 'Satisfaction Guaranteed', desc: "We don't rest until you're happy. If something isn't right, we'll make it right — no questions asked." },
]

const faqs = [
  { question: 'What services does Maintainex offer under one roof?', answer: 'Maintainex provides a complete range of property services including home cleaning, office cleaning, deep cleaning, maintenance and repairs, construction and renovation, landscaping, and pest control. All services are booked through a single platform and delivered by trained, insured professionals.' },
  { question: 'Does Maintainex serve Jaffna and other Sri Lankan cities?', answer: 'Yes, Maintainex operates across Sri Lanka from our Jaffna headquarters. We serve all 25 districts including Jaffna, Colombo, Kandy, Galle, Negombo, Kurunegala, Batticaloa, and more. Our team covers both urban and rural areas.' },
  { question: 'Does Maintainex operate in Canada?', answer: 'Yes, Maintainex has a dedicated Canadian branch serving the Greater Toronto Area including Toronto, Mississauga, Brampton, Scarborough, North York, Markham, Richmond Hill, and surrounding cities.' },
  { question: 'Are Maintainex cleaners and contractors insured?', answer: 'Absolutely. Every professional on the Maintainex platform undergoes background verification, skills assessment, and carries full insurance coverage. Your property and peace of mind are protected on every job.' },
  { question: 'How do I book a service with Maintainex?', answer: 'Booking is easy. Visit our Services page, choose the service you need, select your location and schedule, and confirm. You can also call us directly or send a message on WhatsApp. We confirm your booking within minutes.' },
]

export default function AboutPage() {
  const headersList = headers()
  const host = headersList.get('host') || ''
  const regionKey = getRegionFromHost(host)
  const c = REGIONS[regionKey].countryName
  const cp = REGIONS[regionKey].countryNamePossessive
  const isCA = regionKey === 'CA'
  const baseUrl = isCA ? 'https://ca.maintainex.lk' : 'https://maintainex.lk'

  const breadcrumb = breadcrumbSchema([
    { name: 'Home', url: baseUrl },
    { name: 'About', url: `${baseUrl}/about` },
  ])

  const localBiz = localBusinessSchema(regionKey)
  const faqSchemaData = faqSchema(faqs)
  const orgSchema = organizationSchema(regionKey)

  return (
    <>
      <Script id="breadcrumb-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(breadcrumb)}
      </Script>
      <Script id="local-business-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(localBiz)}
      </Script>
      <Script id="faq-schema" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(faqSchemaData)}
      </Script>
      <Script id="org-schema-about" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(orgSchema)}
      </Script>

      <Header />
      <WhatsAppButton />

      <main className="pt-16 min-h-screen">
        {/* Hero Section */}
        <section className="bg-foreground py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.02em] text-background mb-6">
              About Maintainex — All Services Under One Roof in {c}
            </h1>
            <p className="text-xl text-background/80 max-w-3xl mx-auto">
              From cleaning to construction, maintenance to landscaping — one trusted platform for every property service. Serving {c} with professional excellence.
            </p>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-foreground mb-6">
                  Our Story
                </h2>
                <p className="text-lg text-muted-foreground mb-4">
                  Maintainex was founded with a simple vision: one platform for every property service you'll ever need. No more juggling multiple providers, comparing quotes across different companies, or wondering who to call when something needs fixing.
                </p>
                <p className="text-lg text-muted-foreground mb-4">
                  We started with professional cleaning in {c} and quickly realized our customers needed more — maintenance, repairs, landscaping, pest control, even construction and renovation support. Today, we deliver all services under one roof, backed by trained, vetted, and insured professionals.
                </p>
                <p className="text-lg text-muted-foreground mb-4">
                  From our headquarters in Jaffna to our Canadian branch in Toronto, Maintainex brings the same commitment to quality, reliability, and customer satisfaction to every job. Whether you need a deep clean, a plumbing repair, or a full renovation, we are your all-in-one partner.
                </p>
                <p className="text-lg text-muted-foreground">
                  {cp} most trusted property services platform. One roof. One booking. Endless possibilities for your home and business.
                </p>
              </div>
              <div className="bg-amber-soft rounded-3xl p-8">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-3 md:p-4 bg-card rounded-3xl border border-border">
                    <Briefcase className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-2">1000+</div>
                    <div className="text-muted-foreground">Jobs Completed</div>
                  </div>
                  <div className="text-center p-3 md:p-4 bg-card rounded-3xl border border-border">
                    <Users className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-2">500+</div>
                    <div className="text-muted-foreground">Happy Clients</div>
                  </div>
                  <div className="text-center p-3 md:p-4 bg-card rounded-3xl border border-border">
                    <UserCheck className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-2">50+</div>
                    <div className="text-muted-foreground">Professionals</div>
                  </div>
                  <div className="text-center p-3 md:p-4 bg-card rounded-3xl border border-border">
                    <Star className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    <div className="text-3xl md:text-4xl font-bold text-amber-600 mb-2">4.9★</div>
                    <div className="text-muted-foreground">Average Rating</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Branches */}
        <section className="py-20 bg-muted">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-foreground mb-4">
                Our Branches
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Two countries, one standard of excellence
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-card p-8 rounded-3xl border border-border">
                <MapPin className="w-10 h-10 text-amber-600 mb-4" />
                <h3 className="text-2xl font-bold text-foreground mb-2">Sri Lanka — Jaffna (Headquarters)</h3>
                <p className="text-muted-foreground mb-4">
                  Serving all 25 districts from our headquarters in Jaffna. From Colombo to Batticaloa, Kandy to Kilinochchi — we bring professional property services across the island.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-amber-500" />
                    <span>{REGIONS.LK.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-500" />
                    <span>{REGIONS.LK.email}</span>
                  </div>
                </div>
              </div>
              <div className="bg-card p-8 rounded-3xl border border-border">
                <MapPin className="w-10 h-10 text-amber-600 mb-4" />
                <h3 className="text-2xl font-bold text-foreground mb-2">Canada — Toronto</h3>
                <p className="text-muted-foreground mb-4">
                  Serving the Greater Toronto Area including Toronto, Mississauga, Brampton, Scarborough, North York, Markham, Richmond Hill, and surrounding cities.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-amber-500" />
                    <span>{REGIONS.CA.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-amber-500" />
                    <span>{REGIONS.CA.email}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* All Services Under One Roof */}
        <section className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-foreground mb-4">
                All Services Under One Roof
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Every property service you need, from one trusted platform. Book cleaning, construction, maintenance, and more.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {servicesList.map((service) => (
                <a
                  key={service.slug}
                  href={`/services/${service.slug}`}
                  className="group bg-card p-8 rounded-3xl border border-border hover:border-amber-300 transition-all duration-300"
                >
                  <div className="w-14 h-14 bg-amber-soft rounded-xl flex items-center justify-center mb-5 group-hover:bg-amber-200 transition-colors">
                    <service.icon className="w-7 h-7 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-amber-600 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {service.desc}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Service Areas */}
        <section className="py-20 bg-muted">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-foreground mb-4">
                Service Areas
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Wherever you are, we are just a booking away
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-500" />
                  Sri Lanka
                </h3>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.LK.districts.map((d) => (
                    <span key={d} className="bg-card px-3 py-1.5 rounded-full text-sm text-muted-foreground border border-border">
                      {d}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground/70 mt-4">
                  Headquarters in <strong className="text-foreground">Jaffna</strong>. Active across all 25 districts.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-500" />
                  Canada
                </h3>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.CA.districts.map((d) => (
                    <span key={d} className="bg-card px-3 py-1.5 rounded-full text-sm text-muted-foreground border border-border">
                      {d}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground/70 mt-4">
                  Branch in <strong className="text-foreground">Toronto</strong>, serving the GTA and surrounding areas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-20 bg-background">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-foreground mb-4">
                Why Choose Maintainex?
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                The all-in-one advantage
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {whyChooseUs.map((item) => (
                <div key={item.title} className="flex items-start gap-4 p-6 bg-card rounded-3xl border border-border">
                  <div className="w-10 h-10 bg-amber-soft rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <item.icon className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Industries We Serve */}
        <section className="py-20 bg-muted overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 mb-12">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-foreground mb-4">
                Industries We Serve
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Professional services tailored for every industry
              </p>
            </div>
          </div>
          <IndustriesCarousel />
          <div className="max-w-4xl mx-auto px-5 sm:px-8 mt-16">
            <div className="text-center">
              <p className="text-sm text-amber-600 font-medium uppercase tracking-wider mb-2">Our Partner</p>
              <h3 className="text-2xl font-bold text-foreground mb-4">MX Cleaning Solution</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Reliable cleaning partner committed to excellence
              </p>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-20 bg-background">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-foreground mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-xl text-muted-foreground">
                Everything you need to know about Maintainex
              </p>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="group bg-card rounded-3xl border border-border p-6 transition-shadow">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="font-semibold text-foreground pr-4">{faq.question}</h3>
                    <CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0 group-open:rotate-180 transition-transform" />
                  </summary>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-foreground">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-background mb-6">
              Ready to Experience the Maintainex Difference?
            </h2>
            <p className="text-xl text-background/80 mb-8">
              Book any service — all under one roof. From cleaning to construction, we have you covered.
            </p>
            <a href="/booking" className="inline-block bg-amber-500 hover:bg-amber-600 text-ink font-bold px-8 py-4 rounded-full transition-all duration-300 glow-amber">
              Book a Service Now
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
