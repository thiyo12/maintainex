'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Smartphone, MapPin, Shield, Star, Download, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function AboutClient() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)

  useEffect(() => {
    let bannerShown = false
    const handleScroll = () => {
      if (!bannerShown && window.scrollY > window.innerHeight * 0.8) {
        setBannerVisible(true)
        bannerShown = true
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    { icon: Smartphone, title: 'One App, All Services', desc: 'From cleaning to construction, plumbing to painting — book 50+ professional services from a single app.' },
    { icon: Shield, title: 'Verified Professionals', desc: 'Every tasker is background-checked, trained, and reviewed. Your home is in safe hands.' },
    { icon: MapPin, title: 'Available Across Sri Lanka', desc: 'From Jaffna to Colombo, Kandy to Galle — we cover all 25 districts. Canada launch coming soon.' },
    { icon: Star, title: 'Trusted by Thousands', desc: 'Over 1,000 jobs completed with a 4.9-star average rating. Real reviews from real customers.' },
  ]

  const services = [
    'Home Cleaning', 'Office Cleaning', 'Deep Cleaning', 'Plumbing',
    'Electrical', 'Painting', 'Carpentry', 'Roofing', 'Pest Control',
    'HVAC', 'Moving', 'Landscaping', 'Construction', 'Appliance Repair',
  ]

  const howItWorks = [
    { step: '1', title: 'Download the App', desc: 'Get MaintainEX on your phone. Available for iOS and Android.' },
    { step: '2', title: 'Post Your Job', desc: 'Describe what you need, pick a date, and set your budget.' },
    { step: '3', title: 'Get Matched', desc: 'Verified professionals near you send quotes within minutes.' },
    { step: '4', title: 'Get It Done', desc: 'Choose your tasker, track progress, and pay securely through the app.' },
  ]

  const districts = [
    'Jaffna', 'Colombo', 'Kandy', 'Galle', 'Matale', 'Nuwara Eliya',
    'Batticaloa', 'Trincomalee', 'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa',
    'Vavuniya', 'Mullaitivu', 'Kilinochchi', 'Mannar', 'Badulla', 'Monaragala',
    'Hambantota', 'Matara', 'Ratnapura', 'Kegalle', 'Gampaha', 'Kalutara', 'Ampara',
  ]

  const canadaAreas = [
    'Toronto (Downtown)', 'Scarborough', 'North York', 'Etobicoke', 'York', 'East York',
  ]

  return (
    <>
      {/* FIXED NAVBAR */}
      <nav className="fixed top-0 left-0 w-full h-20 bg-[#0B0C12]/80 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.JPEG" alt="MaintainEX" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-extrabold text-xl tracking-tight"><span className="text-white">Maintain</span><span className="text-brand">EX</span></span>
          </Link>
          <ul className="hidden md:flex items-center gap-8">
            <li><Link href="/" className="text-white hover:text-brand transition font-medium">Home</Link></li>
            <li><Link href="/#features" className="text-white hover:text-brand transition font-medium">Services</Link></li>
            <li><Link href="/#working" className="text-white hover:text-brand transition font-medium">How It Works</Link></li>
            <li><Link href="/about" className="text-brand font-medium">About</Link></li>
            <li><Link href="/#vision-page" className="text-white hover:text-brand transition font-medium">Vision</Link></li>
          </ul>
          <Link href="/#waitlist" className="hidden md:inline-block bg-brand text-black py-3 px-7 rounded-full font-bold text-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-lg transition-all">Join Waitlist</Link>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden flex flex-col justify-center items-center gap-[5px] w-10 h-10 focus:outline-none">
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'translate-y-[7px] rotate-45' : ''}`}></span>
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? '-translate-y-[7px] -rotate-45' : ''}`}></span>
          </button>
        </div>
        <div className={`md:hidden bg-[#0B0C12]/95 backdrop-blur-md border-t border-white/10 flex flex-col items-center gap-5 py-6 transition-all duration-300 overflow-hidden ${mobileOpen ? 'max-h-[400px]' : 'max-h-0'}`}>
          <Link href="/" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Home</Link>
          <Link href="/#features" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Services</Link>
          <Link href="/#working" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">How It Works</Link>
          <Link href="/about" onClick={() => setMobileOpen(false)} className="text-brand text-lg font-medium">About</Link>
          <Link href="/#vision-page" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Vision</Link>
          <Link href="/#waitlist" onClick={() => setMobileOpen(false)} className="bg-brand text-black font-semibold py-3 px-6 rounded-full">Join Waitlist</Link>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero */}
        <section className="bg-[#15161E] py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-6">
              About MaintainEX
            </h1>
            <p className="text-xl text-[#d1d5db] max-w-3xl mx-auto mb-10">
              The app that connects you with trusted professionals for every home service — cleaning, repairs, maintenance, and more. Available in Sri Lanka and expanding worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#waitlist" className="inline-flex items-center gap-2 bg-brand text-black font-bold px-8 py-4 rounded-full transition-all duration-300 glow-amber hover:-translate-y-1">
                <Download className="w-5 h-5" />
                Join the Waitlist
              </Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 border-2 border-white/30 text-white hover:border-brand hover:text-brand font-bold px-8 py-4 rounded-full transition-all duration-300">
                How It Works
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </section>

        {/* What is MaintainEX */}
        <section className="py-20 bg-[#0B0C12]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-6">
                What is MaintainEX?
              </h2>
              <p className="text-lg text-[#d1d5db] leading-relaxed">
                MaintainEX is a marketplace app that connects people who need home services with verified professionals who deliver them. Whether you need a plumber in Jaffna, an electrician in Colombo, or a deep clean in Toronto — one app handles it all.
              </p>
              <p className="text-lg text-[#d1d5db] leading-relaxed mt-4">
                No more calling around, comparing quotes from different companies, or wondering who to trust. Post your job, get matched with a vetted professional, track the work in real-time, and pay securely — all through the app.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((f) => (
                <div key={f.title} className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300">
                  <div className="w-14 h-14 bg-brand/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <f.icon className="w-7 h-7 text-brand" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-[#d1d5db]">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 bg-[#15161E]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
                How It Works
              </h2>
              <p className="text-xl text-[#d1d5db]">
                From download to done — in 4 simple steps
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-8">
              {howItWorks.map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-14 h-14 bg-brand text-black rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-black">
                    {item.step}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-[#d1d5db]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services Available */}
        <section className="py-20 bg-[#0B0C12]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
                50+ Services Available
              </h2>
              <p className="text-xl text-[#d1d5db]">
                Every home service you need, one app away
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
              {services.map((s) => (
                <span key={s} className="bg-[#1a1b24] px-4 py-2 rounded-full text-sm font-medium text-[#d1d5db] border border-white/10 hover:border-brand hover:text-brand transition-colors">
                  {s}
                </span>
              ))}
              <span className="bg-brand/10 px-4 py-2 rounded-full text-sm font-medium text-brand border border-brand/30">
                And 35+ more...
              </span>
            </div>
          </div>
        </section>

        {/* Available Locations */}
        <section className="py-20 bg-[#15161E]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-4">
                Available In
              </h2>
              <p className="text-xl text-[#d1d5db]">
                Serving customers across two countries
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-[#0B0C12] p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">🇱🇰</span>
                  <h3 className="text-xl font-bold text-white">Sri Lanka</h3>
                </div>
                <p className="text-[#d1d5db] mb-4">All 25 districts — from Jaffna to Colombo, Kandy to Galle.</p>
                <div className="flex flex-wrap gap-2">
                  {districts.slice(0, 8).map((d) => (
                    <span key={d} className="text-xs bg-[#1a1b24] px-2.5 py-1 rounded-full text-[#d1d5db]">{d}</span>
                  ))}
                  <span className="text-xs bg-[#1a1b24] px-2.5 py-1 rounded-full text-[#d1d5db]">+{districts.length - 8} more</span>
                </div>
              </div>
              <div className="bg-[#0B0C12] p-8 rounded-3xl border border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">🇨🇦</span>
                  <h3 className="text-xl font-bold text-white">Canada</h3>
                </div>
                <p className="text-[#d1d5db] mb-4">Greater Toronto Area — launching soon.</p>
                <div className="flex flex-wrap gap-2">
                  {canadaAreas.map((d) => (
                    <span key={d} className="text-xs bg-[#1a1b24] px-2.5 py-1 rounded-full text-[#d1d5db]">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Our Mission */}
        <section className="py-20 bg-[#0B0C12]">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-6">
              Our Mission
            </h2>
            <p className="text-lg text-[#d1d5db] leading-relaxed mb-6">
              We believe getting home services should be as easy as ordering food. No phone calls, no haggling, no uncertainty. Just open the app, post what you need, and let verified professionals compete for your job.
            </p>
            <p className="text-lg text-[#d1d5db] leading-relaxed">
              MaintainEX is building the future of home services — a trusted marketplace where quality professionals earn fair wages and customers get reliable, affordable service. Every time.
            </p>
          </div>
        </section>

        {/* Download CTA */}
        <section className="py-20 bg-[#15161E]">
          <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-6">
              Ready to Try MaintainEX?
            </h2>
            <p className="text-xl text-[#d1d5db] mb-8">
              Download the app, post your first job, and get matched with a verified professional in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/#waitlist" className="inline-flex items-center gap-2 bg-brand text-black font-bold px-8 py-4 rounded-full transition-all duration-300 glow-amber hover:-translate-y-1">
                Join the Waitlist
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 border-2 border-white/30 text-white hover:border-brand hover:text-brand font-bold px-8 py-4 rounded-full transition-all duration-300">
                Contact Us
              </Link>
            </div>
            <div className="mt-10 grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
              <div className="flex items-center gap-2 justify-center text-[#d1d5db]">
                <CheckCircle2 className="w-5 h-5 text-brand" />
                <span className="text-sm">Free to download</span>
              </div>
              <div className="flex items-center gap-2 justify-center text-[#d1d5db]">
                <CheckCircle2 className="w-5 h-5 text-brand" />
                <span className="text-sm">No booking fees</span>
              </div>
              <div className="flex items-center gap-2 justify-center text-[#d1d5db]">
                <CheckCircle2 className="w-5 h-5 text-brand" />
                <span className="text-sm">Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#0B0C12]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 md:gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo.JPEG" alt="MaintainEX" className="w-8 h-8 rounded-full object-cover" />
                <span className="font-extrabold text-xl tracking-tight"><span className="text-white">Maintain</span><span className="text-brand">EX</span></span>
              </div>
              <p className="text-[#d1d5db] text-sm max-w-xs mb-4">Your trusted task marketplace. Verified professionals, transparent pricing, 100% satisfaction guaranteed.</p>
              <div className="flex items-center gap-2 text-sm text-[#d1d5db]">
                <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Sri Lanka &bull; Canada
              </div>
            </div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Product</h4><Link href="/#features" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Features</Link><Link href="/#pricing" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Pricing</Link><Link href="/#download" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Mobile App</Link><Link href="/#waitlist" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Join Waitlist</Link></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Platform</h4><Link href="/#client" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">For Seekers</Link><Link href="/#tasker" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">For Professionals</Link><Link href="/#features" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Services</Link><Link href="/#working" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">How It Works</Link></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Company</h4><Link href="/about" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">About Us</Link><Link href="/#vision-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Vision &amp; Mission</Link><Link href="/#investors-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Investors</Link><Link href="/#waitlist" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Careers</Link></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Legal</h4><Link href="/#terms-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Terms of Service</Link><Link href="/#privacy-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Privacy Policy</Link><Link href="/#privacy-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Cookie Policy</Link><Link href="/about" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Security</Link></div>
          </div>
        </div>
        <div className="border-t border-white/10 py-6 px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-sm text-[#9ca3af]">&copy; 2026 MaintainEX. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="https://x.com/maintainex" target="_blank" rel="noopener noreferrer" className="text-[#d1d5db] hover:text-brand transition">Twitter</a>
              <a href="https://instagram.com/maintainex" target="_blank" rel="noopener noreferrer" className="text-[#d1d5db] hover:text-brand transition">Instagram</a>
              <a href="https://linkedin.com/company/maintainex" target="_blank" rel="noopener noreferrer" className="text-[#d1d5db] hover:text-brand transition">LinkedIn</a>
              <a href="https://wa.me/94770867609" target="_blank" rel="noopener noreferrer" className="text-[#d1d5db] hover:text-brand transition">WhatsApp</a>
            </div>
          </div>
        </div>
      </footer>

      {/* WHATSAPP FLOAT */}
      <a href="https://wa.me/94770867609" target="_blank" rel="noopener noreferrer" className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 hover:scale-110 transition-all">
        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 1.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>

      {/* STICKY WAITLIST BANNER */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-brand/95 backdrop-blur-md py-2.5 sm:py-3 px-4 sm:px-6 flex items-center justify-between gap-3 transition-all duration-500 ${bannerVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <span className="text-black font-semibold text-xs sm:text-sm">Don&apos;t miss out — Join the waitlist!</span>
        <Link href="/#waitlist" className="bg-black text-white font-bold py-2 px-4 sm:px-6 rounded-full text-xs sm:text-sm hover:opacity-90 transition whitespace-nowrap">Join Now</Link>
      </div>
    </>
  )
}
