'use client'

import { useState, useEffect } from 'react'

export default function ContactPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        setSuccess(true)
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to send message')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <>
        {/* FIXED NAVBAR */}
        <nav className="fixed top-0 left-0 w-full h-20 bg-[#0B0C12]/80 backdrop-blur-md border-b border-white/10 z-50">
          <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <img src="/logo.JPEG" alt="MaintainEX" className="w-8 h-8 rounded-full object-cover" />
              <span className="font-extrabold text-xl tracking-tight"><span className="text-white">Maintain</span><span className="text-brand">EX</span></span>
            </a>
            <ul className="hidden md:flex items-center gap-8">
              <li><a href="/" className="text-white hover:text-brand transition font-medium">Home</a></li>
              <li><a href="/#features" className="text-white hover:text-brand transition font-medium">Services</a></li>
              <li><a href="/#working" className="text-white hover:text-brand transition font-medium">How It Works</a></li>
              <li><a href="/about" className="text-white hover:text-brand transition font-medium">About</a></li>
              <li><a href="/#vision-page" className="text-white hover:text-brand transition font-medium">Vision</a></li>
            </ul>
            <a href="/#waitlist" className="hidden md:inline-block bg-brand text-black py-3 px-7 rounded-full font-bold text-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-lg transition-all">Join Waitlist</a>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden flex flex-col justify-center items-center gap-[5px] w-10 h-10 focus:outline-none">
              <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'translate-y-[7px] rotate-45' : ''}`}></span>
              <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`}></span>
              <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? '-translate-y-[7px] -rotate-45' : ''}`}></span>
            </button>
          </div>
          <div className={`md:hidden bg-[#0B0C12]/95 backdrop-blur-md border-t border-white/10 flex flex-col items-center gap-5 py-6 transition-all duration-300 overflow-hidden ${mobileOpen ? 'max-h-[400px]' : 'max-h-0'}`}>
            <a href="/" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Home</a>
            <a href="/#features" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Services</a>
            <a href="/#working" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">How It Works</a>
            <a href="/about" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">About</a>
            <a href="/#vision-page" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Vision</a>
            <a href="/#waitlist" onClick={() => setMobileOpen(false)} className="bg-brand text-black font-semibold py-3 px-6 rounded-full">Join Waitlist</a>
          </div>
        </nav>

        <main className="pt-20 min-h-screen bg-[#0B0C12] flex items-center justify-center">
          <div className="max-w-md mx-auto px-5 text-center">
            <div className="bg-[#15161E] rounded-3xl border border-white/10 p-8">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mb-4">Message Sent!</h2>
              <p className="text-[#d1d5db] mb-6">
                Thank you for contacting us. We&apos;ll get back to you within 24 hours.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="bg-brand text-black font-semibold px-6 py-3 rounded-full transition-all duration-300 glow-amber hover:-translate-y-1"
              >
                Send Another Message
              </button>
            </div>
          </div>
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
              <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Product</h4><a href="/#features" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Features</a><a href="/#pricing" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Pricing</a><a href="/#download" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Mobile App</a><a href="/#waitlist" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Join Waitlist</a></div>
              <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Platform</h4><a href="/#client" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">For Seekers</a><a href="/#tasker" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">For Professionals</a><a href="/#features" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Services</a><a href="/#working" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">How It Works</a></div>
              <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Company</h4><a href="/about" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">About Us</a><a href="/#vision-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Vision &amp; Mission</a><a href="/#investors-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Investors</a><a href="/#waitlist" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Careers</a></div>
              <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Legal</h4><a href="/#terms-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Terms of Service</a><a href="/#privacy-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Privacy Policy</a><a href="/#privacy-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Cookie Policy</a><a href="/about" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Security</a></div>
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
          <a href="/#waitlist" className="bg-black text-white font-bold py-2 px-4 sm:px-6 rounded-full text-xs sm:text-sm hover:opacity-90 transition whitespace-nowrap">Join Now</a>
        </div>
      </>
    )
  }

  return (
    <>
      {/* FIXED NAVBAR */}
      <nav className="fixed top-0 left-0 w-full h-20 bg-[#0B0C12]/80 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.JPEG" alt="MaintainEX" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-extrabold text-xl tracking-tight"><span className="text-white">Maintain</span><span className="text-brand">EX</span></span>
          </a>
          <ul className="hidden md:flex items-center gap-8">
            <li><a href="/" className="text-white hover:text-brand transition font-medium">Home</a></li>
            <li><a href="/#features" className="text-white hover:text-brand transition font-medium">Services</a></li>
            <li><a href="/#working" className="text-white hover:text-brand transition font-medium">How It Works</a></li>
            <li><a href="/about" className="text-white hover:text-brand transition font-medium">About</a></li>
            <li><a href="/#vision-page" className="text-white hover:text-brand transition font-medium">Vision</a></li>
          </ul>
          <a href="/#waitlist" className="hidden md:inline-block bg-brand text-black py-3 px-7 rounded-full font-bold text-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-lg transition-all">Join Waitlist</a>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden flex flex-col justify-center items-center gap-[5px] w-10 h-10 focus:outline-none">
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'translate-y-[7px] rotate-45' : ''}`}></span>
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? '-translate-y-[7px] -rotate-45' : ''}`}></span>
          </button>
        </div>
        <div className={`md:hidden bg-[#0B0C12]/95 backdrop-blur-md border-t border-white/10 flex flex-col items-center gap-5 py-6 transition-all duration-300 overflow-hidden ${mobileOpen ? 'max-h-[400px]' : 'max-h-0'}`}>
          <a href="/" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Home</a>
          <a href="/#features" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Services</a>
          <a href="/#working" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">How It Works</a>
          <a href="/about" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">About</a>
          <a href="/#vision-page" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Vision</a>
          <a href="/#waitlist" onClick={() => setMobileOpen(false)} className="bg-brand text-black font-semibold py-3 px-6 rounded-full">Join Waitlist</a>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="bg-[#15161E] py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white mb-6">
              Contact Us
            </h1>
            <p className="text-xl text-[#d1d5db] max-w-3xl mx-auto">
              Have questions? We&apos;d love to hear from you. Get in touch with us today.
            </p>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className="py-16 bg-[#0B0C12]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-[#15161E] rounded-3xl border border-white/10 hover:border-brand/30 transition-all">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Phone</h3>
                <p className="text-[#d1d5db] mb-2">Call or WhatsApp</p>
                <a href="tel:+94770867609" className="text-brand font-semibold hover:text-brand/80">
                  +94 77 086 7609
                </a>
              </div>

              <div className="text-center p-8 bg-[#15161E] rounded-3xl border border-white/10 hover:border-brand/30 transition-all">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Email</h3>
                <p className="text-[#d1d5db] mb-2">We reply within 24h</p>
                <a href="mailto:maintainex.lk@gmail.com" className="text-brand font-semibold hover:text-brand/80">
                  maintainex.lk@gmail.com
                </a>
              </div>

              <div className="text-center p-8 bg-[#15161E] rounded-3xl border border-white/10 hover:border-brand/30 transition-all">
                <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Working Hours</h3>
                <p className="text-[#d1d5db] mb-2">Mon - Sat</p>
                <p className="text-brand font-semibold">8:00 AM - 6:00 PM</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form & Location */}
        <section className="py-16 bg-[#15161E]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div className="bg-[#0B0C12] rounded-3xl border border-white/10 p-8">
                <h2 className="text-2xl font-black tracking-tight text-white mb-6">Send us a Message</h2>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all bg-[#1a1b24] text-white placeholder:text-gray-500"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all bg-[#1a1b24] text-white placeholder:text-gray-500"
                        placeholder="0771234567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all bg-[#1a1b24] text-white placeholder:text-gray-500"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Subject *
                    </label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all bg-[#1a1b24] text-white"
                    >
                      <option value="">Select a subject</option>
                      <option value="general">General Inquiry</option>
                      <option value="support">App Support</option>
                      <option value="partnership">Partnership</option>
                      <option value="feedback">Feedback</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Message *
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full px-4 py-3 border border-white/10 rounded-xl focus:ring-2 focus:ring-brand focus:border-brand outline-none transition-all resize-none bg-[#1a1b24] text-white placeholder:text-gray-500"
                      placeholder="How can we help you?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-brand text-black font-bold py-4 rounded-full transition-all duration-300 glow-amber disabled:opacity-50 flex items-center justify-center gap-2 hover:-translate-y-1"
                  >
                    {submitting ? 'Sending...' : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Location Info */}
              <div>
                <div className="bg-[#0B0C12] rounded-3xl border border-white/10 p-8 mb-8">
                  <h2 className="text-2xl font-black tracking-tight text-white mb-6">Our Locations</h2>

                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Jaffna — Headquarters</h4>
                        <p className="text-[#d1d5db]">Jaffna, Sri Lanka</p>
                        <p className="text-sm text-[#9ca3af]">Main operations center — serving all 25 districts</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-white">Canada — Toronto</h4>
                        <p className="text-[#d1d5db]">Toronto, Ontario, Canada</p>
                        <p className="text-sm text-[#9ca3af]">Serving GTA and surrounding areas</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download App CTA */}
                <div className="bg-brand rounded-3xl p-8 text-center">
                  <h3 className="text-xl font-bold text-black mb-4">Download the MaintainEX App</h3>
                  <p className="text-black/80 mb-6">Book services, track jobs, and pay securely — all in one app.</p>
                  <a
                    href="/#waitlist"
                    className="inline-flex items-center gap-2 bg-black text-white font-bold px-8 py-4 rounded-full transition-all duration-300 hover:opacity-90"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Join the Waitlist
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-[#0B0C12]">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <h2 className="text-2xl font-black tracking-tight text-white mb-8 text-center">Frequently Asked Questions</h2>

            <div className="space-y-4">
              <div className="bg-[#15161E] rounded-3xl border border-white/10 p-6">
                <h4 className="font-bold text-white mb-2">What areas does MaintainEX cover?</h4>
                <p className="text-[#d1d5db]">MaintainEX covers all 25 districts across Sri Lanka from our Jaffna headquarters, plus the Greater Toronto Area in Canada. Download the app to check availability in your area.</p>
              </div>

              <div className="bg-[#15161E] rounded-3xl border border-white/10 p-6">
                <h4 className="font-bold text-white mb-2">How do I book a service?</h4>
                <p className="text-[#d1d5db]">Simply download the MaintainEX app, post your job with details, and verified professionals in your area will send you quotes. Choose the best one and track the work in real-time.</p>
              </div>

              <div className="bg-[#15161E] rounded-3xl border border-white/10 p-6">
                <h4 className="font-bold text-white mb-2">Is MaintainEX free to use?</h4>
                <p className="text-[#d1d5db]">Yes! Downloading the app and posting jobs is completely free. You only pay when you hire a professional and confirm the service is complete.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Internal Links */}
        <section className="py-12 bg-[#15161E]">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
            <p className="text-[#d1d5db]">
              <a href="/#waitlist" className="text-brand hover:text-brand/80 font-semibold">Join the waitlist</a>
              {' '}to get early access when MaintainEX launches, or{' '}
              <a href="/about" className="text-brand hover:text-brand/80 font-semibold">learn more about us</a>.
            </p>
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
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Product</h4><a href="/#features" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Features</a><a href="/#pricing" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Pricing</a><a href="/#download" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Mobile App</a><a href="/#waitlist" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Join Waitlist</a></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Platform</h4><a href="/#client" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">For Seekers</a><a href="/#tasker" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">For Professionals</a><a href="/#features" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Services</a><a href="/#working" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">How It Works</a></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Company</h4><a href="/about" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">About Us</a><a href="/#vision-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Vision &amp; Mission</a><a href="/#investors-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Investors</a><a href="/#waitlist" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Careers</a></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-[#9ca3af] mb-4">Legal</h4><a href="/#terms-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Terms of Service</a><a href="/#privacy-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Privacy Policy</a><a href="/#privacy-page" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Cookie Policy</a><a href="/about" className="block text-[#d1d5db] text-sm hover:text-brand transition py-1">Security</a></div>
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
        <a href="/#waitlist" className="bg-black text-white font-bold py-2 px-4 sm:px-6 rounded-full text-xs sm:text-sm hover:opacity-90 transition whitespace-nowrap">Join Now</a>
      </div>
    </>
  )
}
