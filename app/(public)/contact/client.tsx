'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useRegion } from '@/lib/region-context'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiMapPin, FiPhone, FiMail, FiClock, FiSend, FiCheck } from 'react-icons/fi'

export default function ContactPage() {
  const region = useRegion()
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
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <>
        <Header />
        <WhatsAppButton />
        <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
          <div className="max-w-md mx-auto px-5 text-center">
            <div className="bg-card rounded-3xl border border-border p-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiCheck className="text-4xl text-green-600" />
              </div>
              <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-4">Message Sent!</h2>
              <p className="text-muted-foreground mb-6">
                Thank you for contacting us. We'll get back to you within 24 hours.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="bg-amber-500 hover:bg-amber-600 text-ink font-semibold px-6 py-3 rounded-full transition-all duration-300"
              >
                Send Another Message
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-16">
        {/* Hero Section */}
        <section className="bg-foreground py-20">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-[-0.02em] text-background mb-6">
              Contact Us
            </h1>
            <p className="text-xl text-background/80 max-w-3xl mx-auto">
              Have questions? We'd love to hear from you. Get in touch with us today.
            </p>
          </div>
        </section>

        {/* Contact Info Cards */}
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-8 bg-card rounded-3xl border border-border">
                <div className="w-16 h-16 bg-amber-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiPhone className="text-3xl text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Phone</h3>
                <p className="text-muted-foreground mb-2">Call or WhatsApp</p>
                <a href={`tel:${region.phoneRaw}`} className="text-amber-600 font-semibold hover:text-amber-700">
                  {region.phone}
                </a>
              </div>

              <div className="text-center p-8 bg-card rounded-3xl border border-border">
                <div className="w-16 h-16 bg-amber-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiMail className="text-3xl text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Email</h3>
                <p className="text-muted-foreground mb-2">We reply within 24h</p>
                <a href="mailto:maintainex.lk@gmail.com" className="text-amber-600 font-semibold hover:text-amber-700">
                  maintainex.lk@gmail.com
                </a>
              </div>

              <div className="text-center p-8 bg-card rounded-3xl border border-border">
                <div className="w-16 h-16 bg-amber-soft rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiClock className="text-3xl text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Working Hours</h3>
                <p className="text-muted-foreground mb-2">Mon - Sat</p>
                <p className="text-amber-600 font-semibold">8:00 AM - 6:00 PM</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form & Map */}
        <section className="py-16 bg-muted">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Contact Form */}
              <div className="bg-card rounded-3xl border border-border p-8">
                <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-6">Send us a Message</h2>
                
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6">
                    {error}
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-card text-foreground placeholder:text-muted-foreground"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-card text-foreground placeholder:text-muted-foreground"
                        placeholder="0771234567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-card text-foreground placeholder:text-muted-foreground"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Subject *
                    </label>
                    <select
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all bg-card text-foreground"
                    >
                      <option value="">Select a subject</option>
                      <option value="booking">Booking Inquiry</option>
                      <option value="pricing">Pricing Question</option>
                      <option value="complaint">Complaint</option>
                      <option value="partnership">Partnership</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Message *
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full px-4 py-3 border-2 border-border rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none bg-card text-foreground placeholder:text-muted-foreground"
                      placeholder="How can we help you?"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-ink font-bold py-4 rounded-full transition-all duration-300 glow-amber disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? 'Sending...' : (
                      <>
                        <FiSend />
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Location Info */}
              <div>
                <div className="bg-card rounded-3xl border border-border p-8 mb-8">
                  <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-6">Our Locations</h2>
                  
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-amber-soft rounded-full flex items-center justify-center flex-shrink-0">
                        <FiMapPin className="text-xl text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">Jaffna — Headquarters</h4>
                        <p className="text-muted-foreground">Jaffna, {region.countryName}</p>
                        <p className="text-sm text-muted-foreground/70">Main operations center — serving all 25 districts</p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-amber-soft rounded-full flex items-center justify-center flex-shrink-0">
                        <FiMapPin className="text-xl text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">Canada — Toronto</h4>
                        <p className="text-muted-foreground">Toronto, Ontario, Canada</p>
                        <p className="text-sm text-muted-foreground/70">Serving GTA and surrounding areas</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Contact */}
                <div className="bg-foreground rounded-3xl p-8 text-center">
                  <h3 className="text-xl font-bold text-background mb-4">Need Immediate Help?</h3>
                  <p className="text-background/80 mb-6">Call us directly for instant support</p>
                  <a 
                    href={`tel:${region.phoneRaw}`} 
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-ink font-bold px-8 py-4 rounded-full transition-all duration-300 glow-amber"
                  >
                    <FiPhone />
                    {region.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Media */}
        <section className="py-16 bg-background border-t border-border">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-4">Follow Us</h2>
            <p className="text-muted-foreground mb-8">Stay connected on social media for updates, tips, and offers</p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { name: 'Facebook', url: 'https://facebook.com/maintainex.lk', icon: 'M' },
                { name: 'Instagram', url: 'https://instagram.com/maintainex.lk', icon: 'I' },
                { name: 'LinkedIn', url: 'https://linkedin.com/company/maintainex-lk', icon: 'L' },
                { name: 'TikTok', url: 'https://tiktok.com/@maintainex.lk', icon: 'T' },
                { name: 'X', url: 'https://x.com/maintainexlk', icon: 'X' },
                { name: 'WhatsApp', url: 'https://wa.me/94770867609', icon: 'W' },
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3 bg-card border border-border rounded-full hover:border-amber-300 hover:bg-amber-soft/50 transition-all text-foreground font-medium"
                >
                  <span className="w-8 h-8 rounded-full bg-amber-soft flex items-center justify-center text-amber-600 font-bold text-sm">
                    {s.icon}
                  </span>
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-background">
          <div className="max-w-3xl mx-auto px-5 sm:px-8">
            <h2 className="text-2xl font-black tracking-[-0.02em] text-foreground mb-8 text-center">Frequently Asked Questions</h2>
            
            <div className="space-y-4">
              <div className="bg-card rounded-3xl border border-border p-6">
                <h4 className="font-bold text-foreground mb-2">What areas do you service?</h4>
                <p className="text-muted-foreground">We service all districts across {region.countryName} from our Jaffna headquarters, plus the Greater Toronto Area in Canada.</p>
              </div>
              
              <div className="bg-card rounded-3xl border border-border p-6">
                <h4 className="font-bold text-foreground mb-2">How quickly can I get a booking?</h4>
                <p className="text-muted-foreground">We typically offer same-day or next-day service. Book online or call us for urgent requests.</p>
              </div>
              
              <div className="bg-card rounded-3xl border border-border p-6">
                <h4 className="font-bold text-foreground mb-2">Are your cleaners insured?</h4>
                <p className="text-muted-foreground">Yes! All our team members are fully trained and insured for your peace of mind.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Internal Links */}
        <section className="py-12 bg-muted">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
            <p className="text-muted-foreground">
              <a href="/services" className="text-amber-600 hover:text-amber-700 font-semibold">Browse our services</a>
              {' '}or{' '}
              <a href="/booking" className="text-amber-600 hover:text-amber-700 font-semibold">book online</a>
              {' '}to get started.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
