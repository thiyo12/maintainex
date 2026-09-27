'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  Building2,
  Bug,
  CheckCircle2,
  Droplet,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Smartphone,
  Truck,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

type ServiceShortcut = {
  title: string
  description: string
  category: string
  keywords: string[]
  icon: LucideIcon
}

const services: ServiceShortcut[] = [
  {
    title: 'Cleaning',
    description: 'Deep cleaning, home care, office cleaning and move-in / move-out help.',
    category: 'cleaning',
    keywords: ['clean', 'deep clean', 'house', 'office', 'dust', 'floor'],
    icon: Sparkles,
  },
  {
    title: 'AC & cooling',
    description: 'AC not cooling, servicing, installation and appliance support.',
    category: 'ac-service',
    keywords: ['ac', 'air conditioner', 'cooling', 'fridge', 'appliance'],
    icon: Snowflake,
  },
  {
    title: 'Plumbing & water',
    description: 'Leaks, taps, sinks, toilets, blocked drains and water problems.',
    category: 'plumbing',
    keywords: ['water', 'leak', 'tap', 'sink', 'toilet', 'drain', 'plumber'],
    icon: Droplet,
  },
  {
    title: 'Electrical',
    description: 'Sockets, wiring, panels, power trips, lights and electrical repairs.',
    category: 'electrical',
    keywords: ['electric', 'power', 'socket', 'wiring', 'light', 'trip'],
    icon: Zap,
  },
  {
    title: 'Repairs & handyman',
    description: 'General repairs, mounting, assembly and maintenance work.',
    category: 'repairs',
    keywords: ['repair', 'handyman', 'mount', 'assembly', 'maintenance'],
    icon: Wrench,
  },
  {
    title: 'Pest control',
    description: 'Help with insects, rodents and common household pest problems.',
    category: 'pest-control',
    keywords: ['pest', 'insect', 'cockroach', 'rat', 'termite'],
    icon: Bug,
  },
  {
    title: 'Moving help',
    description: 'Moving, shifting, lifting and transport-related assistance.',
    category: 'moving',
    keywords: ['move', 'moving', 'shift', 'truck', 'transport', 'lift'],
    icon: Truck,
  },
  {
    title: 'Business & property',
    description: 'Commercial maintenance, property support and company service needs.',
    category: 'homecare',
    keywords: ['business', 'commercial', 'property', 'office', 'company'],
    icon: Building2,
  },
]

const problems = [
  { label: 'AC not cooling', category: 'ac-service' },
  { label: 'Water leak', category: 'plumbing' },
  { label: 'Power trip', category: 'electrical' },
  { label: 'Blocked drain', category: 'plumbing' },
  { label: 'Deep cleaning', category: 'cleaning' },
  { label: 'Pest problem', category: 'pest-control' },
  { label: 'Need a handyman', category: 'repairs' },
  { label: 'Moving help', category: 'moving' },
]

const steps = [
  {
    number: '01',
    title: 'Tell us what you need',
    description: 'Start with the problem, service or job you need completed.',
    icon: Search,
  },
  {
    number: '02',
    title: 'Get matched',
    description: 'MaintainEX connects the request with suitable taskers or service companies.',
    icon: BellRing,
  },
  {
    number: '03',
    title: 'Compare and confirm',
    description: 'Review the provider, quote and job details before you confirm.',
    icon: MessageSquareText,
  },
  {
    number: '04',
    title: 'Complete the job safely',
    description: 'Use the app for job status, start verification, payment flow and review.',
    icon: ShieldCheck,
  },
]

export default function HomeClient() {
  const [query, setQuery] = useState('')

  const filteredServices = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return services

    return services.filter((service) => {
      const haystack = [
        service.title,
        service.description,
        ...service.keywords,
      ].join(' ').toLowerCase()
      return haystack.includes(value)
    })
  }, [query])

  return (
    <main className="min-h-screen bg-[#0B0C12] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0B0C12]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="MaintainEX home">
            <img
              src="/logo.JPEG"
              alt="MaintainEX"
              className="h-9 w-9 rounded-xl object-cover"
            />
            <span className="text-lg font-black tracking-tight">
              MΛINTΛIN<span className="text-amber-400">EX</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/75 md:flex">
            <a href="#service-finder" className="transition hover:text-white">Find a service</a>
            <a href="#how-it-works" className="transition hover:text-white">How it works</a>
            <a href="#roles" className="transition hover:text-white">For providers</a>
            <Link href="/contact" className="transition hover:text-white">Support</Link>
          </nav>

          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-black transition hover:bg-amber-300"
          >
            Browse services
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-16rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="absolute bottom-[-12rem] right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-white/5 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.08fr_.92fr] md:items-center md:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-300">
              <MapPin className="h-4 w-4" />
              Built for local jobs, homes and businesses
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Find the right help.
              <span className="block text-amber-400">Continue in MaintainEX.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
              Start with the problem you need solved. Explore the right service, understand the workflow,
              then continue with the MaintainEX app for quotes, job coordination and completion.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#service-finder"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 py-4 font-extrabold text-black transition hover:bg-amber-300"
              >
                What do you need help with?
                <ArrowRight className="h-5 w-5" />
              </a>
              <Link
                href="/waitlist"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-bold text-white transition hover:bg-white/10"
              >
                <Smartphone className="h-5 w-5" />
                Get app access
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-white/60">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> Customer, tasker and company paths</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> Quote and job workflow in one app</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" /> Sri Lanka first, built to expand</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-amber-400/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#13151d] p-3 shadow-2xl">
              <img
                src="/app-splash.png"
                alt="MaintainEX mobile app"
                className="w-full rounded-[1.75rem] object-cover"
              />
              <div className="grid grid-cols-3 gap-2 pt-3 text-center text-xs font-bold text-white/70">
                <div className="rounded-xl bg-white/5 px-2 py-3">Find work</div>
                <div className="rounded-xl bg-white/5 px-2 py-3">Get quotes</div>
                <div className="rounded-xl bg-white/5 px-2 py-3">Track jobs</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="service-finder" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">Start with the problem</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            What do you need help with?
          </h2>
          <p className="mt-4 text-white/60">
            You do not need to know the exact service name. Search the problem and we will point you to the closest service category.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <label htmlFor="service-search" className="sr-only">Search services</label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <Search className="h-5 w-5 shrink-0 text-amber-400" />
            <input
              id="service-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “water leak”, “AC”, “deep cleaning”, “power trip”…"
              className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/35"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {problems.map((problem) => (
              <Link
                key={problem.label}
                href={`/services?category=${problem.category}`}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:border-amber-300/50 hover:bg-amber-400/10 hover:text-white"
              >
                {problem.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredServices.map((service) => {
            const Icon = service.icon
            return (
              <Link
                key={service.title}
                href={`/services?category=${service.category}`}
                className="group rounded-3xl border border-white/10 bg-[#12141b] p-5 transition hover:-translate-y-1 hover:border-amber-300/40 hover:bg-[#171921]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-400">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-extrabold">{service.title}</h3>
                <p className="mt-2 min-h-16 text-sm leading-6 text-white/55">{service.description}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-amber-400">
                  Explore service
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            )
          })}
        </div>

        {filteredServices.length === 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="font-bold">We could not match that phrase yet.</p>
            <p className="mt-2 text-sm text-white/55">Browse the full service catalogue or contact MaintainEX support.</p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/services" className="rounded-full bg-amber-400 px-5 py-3 font-extrabold text-black">Browse all services</Link>
              <Link href="/contact" className="rounded-full border border-white/15 px-5 py-3 font-bold">Contact support</Link>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/services" className="inline-flex items-center gap-2 font-extrabold text-amber-400">
            See the full service catalogue
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">How MaintainEX works</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">One job lifecycle, clearly explained.</h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <div key={step.number} className="rounded-3xl border border-white/10 bg-[#101219] p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-white/15">{step.number}</span>
                    <Icon className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="mt-6 text-xl font-extrabold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/55">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 md:py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">Choose your path</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">MaintainEX is more than a customer app.</h2>
          <p className="mt-4 text-white/60">
            Customers find help, independent taskers find work, and service companies can coordinate jobs and workers through the same platform.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <div className="rounded-[2rem] border border-amber-300/30 bg-amber-400 p-7 text-black">
            <Users className="h-8 w-8" />
            <h3 className="mt-8 text-2xl font-black">I need a service</h3>
            <p className="mt-3 text-sm leading-6 text-black/70">
              Discover the right category, compare the workflow and continue to the app when you are ready.
            </p>
            <Link href="/services" className="mt-7 inline-flex items-center gap-2 font-black">
              Find a service <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#12141b] p-7">
            <BriefcaseBusiness className="h-8 w-8 text-amber-400" />
            <h3 className="mt-8 text-2xl font-black">I want to work as a tasker</h3>
            <p className="mt-3 text-sm leading-6 text-white/55">
              Join MaintainEX as an independent provider, receive suitable opportunities and manage work from the app.
            </p>
            <Link href="/waitlist?role=TASKER" className="mt-7 inline-flex items-center gap-2 font-black text-amber-400">
              Join as a tasker <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#12141b] p-7">
            <Building2 className="h-8 w-8 text-amber-400" />
            <h3 className="mt-8 text-2xl font-black">We are a service company</h3>
            <p className="mt-3 text-sm leading-6 text-white/55">
              Use the company path for team-based service delivery, worker assignment and business job operations.
            </p>
            <Link href="/waitlist?role=COMPANY" className="mt-7 inline-flex items-center gap-2 font-black text-amber-400">
              Join as a company <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 md:pb-24">
        <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-amber-400 to-amber-300 p-7 text-black sm:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em]">
                <BadgeCheck className="h-5 w-5" />
                Mobile app access
              </div>
              <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                The website helps you choose. The app runs the job.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-black/70 sm:text-base">
                Until the public store release is live, use early access to register your interest. We will replace this with direct App Store and Google Play links when the production builds are published.
              </p>
            </div>
            <Link
              href="/waitlist"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-black px-6 py-4 font-extrabold text-white"
            >
              <Smartphone className="h-5 w-5" />
              Get early access
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-3">
              <img src="/logo.JPEG" alt="" className="h-9 w-9 rounded-xl object-cover" />
              <span className="font-black">MΛINTΛINEX</span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
              A service marketplace connecting customers with independent taskers and service companies.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-white/60">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/services" className="hover:text-white">Services</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
            <Link href="/careers" className="hover:text-white">Careers</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
