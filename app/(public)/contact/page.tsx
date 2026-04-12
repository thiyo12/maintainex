'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import WhatsAppButton from '@/components/layout/WhatsAppButton'
import { FiMail, FiPhone, FiMapPin, FiClock, FiMessageCircle, FiSend } from 'react-icons/fi'
import toast from 'react-hot-toast'

interface ContactFormData {
  name: string
  phone: string
  email: string
  subject: string
  message: string
}

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    phone: '',
    email: '',
    subject: '',
    message: ''
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.phone || !formData.email || !formData.subject || !formData.message) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) throw new Error('Failed to send message')

      toast.success('Message sent successfully! We will contact you soon.')
      setFormData({ name: '', phone: '', email: '', subject: '', message: '' })
    } catch (error) {
      toast.error('Failed to send message. Please try again or contact via WhatsApp.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Header />
      <WhatsAppButton />
      
      <main className="pt-20">
        <section className="py-24 gradient-bg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-dark-900 mb-6">Contact Us</h1>
            <p className="text-xl text-dark-900/80 max-w-3xl mx-auto">
              Get in touch with us for inquiries, quotes, or any questions about our services.
            </p>
          </div>
        </section>

        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16">
              <div>
                <h2 className="text-3xl font-bold text-dark-900 mb-8">Get in Touch</h2>
                
                <div className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
                      <FiMapPin className="text-dark-900 text-xl" />
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-900 mb-1">Our Location</h3>
                      <p className="text-gray-600">57/1 New Senguntha Road, Thirunelvaly, Sri Lanka</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
                      <FiPhone className="text-dark-900 text-xl" />
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-900 mb-1">Phone Number</h3>
                      <p className="text-gray-600">0770867609</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
                      <FiMail className="text-dark-900 text-xl" />
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-900 mb-1">Email Address</h3>
                      <p className="text-gray-600">maintainex.lk@gmail.com</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
                      <FiClock className="text-dark-900 text-xl" />
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-900 mb-1">Working Hours</h3>
                      <p className="text-gray-600">Monday - Saturday: 7:00 AM - 7:00 PM<br/>Sunday: 9:00 AM - 5:00 PM</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-dark-900 font-bold">fb</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-900 mb-1">Facebook</h3>
                      <a href="https://facebook.com/maintainex.lk" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">facebook.com/maintainex.lk</a>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-dark-900 font-bold">ig</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-dark-900 mb-1">Instagram</h3>
                      <a href="https://instagram.com/maintainex.lk" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">@maintainex.lk</a>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-green-50 rounded-2xl">
                  <div className="flex items-center space-x-4">
                    <FiMessageCircle className="text-green-500 text-4xl" />
                    <div>
                      <h3 className="font-bold text-dark-900">Quick Chat</h3>
                      <p className="text-gray-600 text-sm mb-2">Get instant responses via WhatsApp</p>
                      <a 
                        href="https://wa.me/94770867609"
                        className="inline-flex items-center text-green-600 font-semibold hover:text-green-700"
                      >
                        Chat Now
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-dark-900 mb-8">Find Us</h2>
                <div className="w-full h-96 bg-gray-200 rounded-2xl overflow-hidden">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d125642.23645577654!2d80.0016!3d9.6680!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3afe53fd9420b8c7%3A0x2b6ed0d79c7a0c8e!2sJaffna%2C%20Sri%20Lanka!5e0!3m2!1sen!2sus!4v1699000000000!5m2!1sen!2sus"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="rounded-2xl"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-dark-900 mb-4">Send Us a Message</h2>
              <p className="text-gray-600">Fill out the form below and we will get back to you as soon as possible.</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-10 lg:p-12 space-y-5 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Your Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="input-field text-sm sm:text-base"
                    placeholder="Enter your name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input-field text-sm sm:text-base"
                    placeholder="077XXXXXXX"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field text-sm sm:text-base"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Subject *</label>
                <select
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="input-field text-sm sm:text-base"
                  required
                >
                  <option value="">Select a subject</option>
                  <option value="inquiry">General Inquiry</option>
                  <option value="quote">Request a Quote</option>
                  <option value="support">Customer Support</option>
                  <option value="feedback">Feedback</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2 text-sm sm:text-base">Message *</label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  rows={4}
                  className="input-field resize-none text-sm sm:text-base"
                  placeholder="How can we help you?"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base py-3"
              >
                <FiSend />
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
