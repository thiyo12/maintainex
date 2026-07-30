'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'

export default function HomeClient() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDot, setActiveDot] = useState('hero')
  const [bannerVisible, setBannerVisible] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
  const confettiBoxRef = useRef<HTMLDivElement>(null)

  const launchConfetti = useCallback(() => {
    const box = confettiBoxRef.current
    if (!box) return
    const colors = ['#F59E0B','#FBBF24','#D97706','#10B981','#3B82F6','#EC4899','#8B5CF6','#EF4444','#FF6B35','#00D4FF']

    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div')
      el.className = 'confetti'
      el.style.left = Math.random() * 100 + '%'
      const sz = 5 + Math.random() * 8
      el.style.width = sz + 'px'
      el.style.height = (Math.random() > 0.5 ? sz : sz * 1.8) + 'px'
      el.style.background = colors[Math.floor(Math.random() * colors.length)]
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px'
      el.style.animationDuration = (1.5 + Math.random() * 2) + 's'
      el.style.animationDelay = (Math.random() * 0.5) + 's'
      box.appendChild(el)
    }

    const rocketXPositions = [12, 30, 50, 70, 88]
    rocketXPositions.forEach(function(pos, i) {
      setTimeout(function() {
        const rocket = document.createElement('div')
        rocket.className = 'rocket'
        rocket.style.left = pos + '%'
        rocket.style.background = 'linear-gradient(to top, ' + colors[i % colors.length] + ', #fff)'
        box.appendChild(rocket)
        setTimeout(function() {
          rocket.remove()
          burstSparks(box, pos, 20, colors)
        }, 950)
      }, i * 300)
    })

    setTimeout(function() { box.innerHTML = '' }, 5500)
  }, [])

  function burstSparks(container: HTMLDivElement, xPercent: number, count: number, colors: string[]) {
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div')
      spark.className = 'spark'
      spark.style.left = xPercent + '%'
      spark.style.bottom = (15 + Math.random() * 30) + '%'
      spark.style.background = colors[Math.floor(Math.random() * colors.length)]
      spark.style.width = (4 + Math.random() * 5) + 'px'
      spark.style.height = spark.style.width
      container.appendChild(spark)

      const angle = (i / count) * Math.PI * 2
      const dist = 40 + Math.random() * 80
      const endX = Math.cos(angle) * dist
      const endY = -Math.abs(Math.sin(angle)) * dist
      const dur = 600 + Math.random() * 400
      let start: number | null = null

      function animate(ts: number) {
        if (!start) start = ts
        const progress = (ts - start) / dur
        if (progress >= 1) { spark.remove(); return }
        const ease = 1 - Math.pow(1 - progress, 3)
        spark.style.transform = 'translate(' + endX * ease + 'px, ' + (endY * ease + progress * 60) + 'px) scale(' + (1 - progress * 0.5) + ')'
        spark.style.opacity = String(1 - progress * 0.8)
        requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    }
  }

  useEffect(() => {
    let bannerShown = false

    const handleScroll = () => {
      if (!bannerShown && window.scrollY > window.innerHeight * 0.8) {
        setBannerVisible(true)
        bannerShown = true
      }
    }
    window.addEventListener('scroll', handleScroll)

    const sections = document.querySelectorAll('section[id]')
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id')
          if (id) setActiveDot(id)
        }
      })
    }, { threshold: 0.3 })
    sections.forEach(s => sectionObserver.observe(s))

    return () => {
      window.removeEventListener('scroll', handleScroll)
      sectionObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    import('aos').then(AOS => {
      AOS.default.init({ duration: 600, once: true, offset: 80 })
    })
  }, [])

  const toggleFaq = (index: number) => {
    setFaqOpen(prev => prev === index ? null : index)
  }

  const faqData = [
    { q: 'What is MaintainEX?', a: 'MaintainEX is a task marketplace connecting seekers with verified professionals for any job — personal, business, or local tasks of all kinds.' },
    { q: 'How much does it cost?', a: "Prices are set by the professionals and shown upfront before you book. There's a 10% platform fee included in the price — no hidden fees." },
    { q: 'Are the professionals verified?', a: 'Yes. Every professional undergoes background checks, ID verification, and skill assessments before joining our platform.' },
    { q: "What if I'm not satisfied?", a: "We offer a 100% satisfaction guarantee. If you're not happy with the work, we'll make it right or refund your money." },
    { q: 'How do I register as a professional?', a: "Sign up on our waitlist as a Professional or Agency. Once we launch, you'll go through a verification process and can start accepting tasks immediately." },
    { q: 'When will the app be available?', a: "We're launching soon! Join the waitlist to get early access and exclusive launch perks on both iOS and Android." },
    { q: 'Is my data safe?', a: 'Yes. We use modern encryption and never share your data with third parties without your consent.' },
  ]

  const getFaqIcon = (i: number) => {
    switch (i) {
      case 0: return <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      case 1: return <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      case 2: return <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      case 3: return <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      case 4: return <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
      case 5: return <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      case 6: return <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      default: return null
    }
  }

  return (
    <>
      {/* VERTICAL NAV DOTS */}
      <nav className="hidden md:flex flex-col items-center gap-2 fixed top-1/2 right-6 -translate-y-1/2 z-50">
        <a href="#hero" className={`nav-dot ${activeDot === 'hero' ? 'active' : ''}`} style={{ transform: 'translateX(4px)' }}><span className="dot" data-label="Home">I</span></a>
        <a href="#message" className={`nav-dot ${activeDot === 'message' ? 'active' : ''}`} style={{ transform: 'translateX(8px)' }}><span className="dot" data-label="Why Us">II</span></a>
        <a href="#problem" className={`nav-dot ${activeDot === 'problem' ? 'active' : ''}`} style={{ transform: 'translateX(13px)' }}><span className="dot" data-label="The Problem">III</span></a>
        <a href="#solution" className={`nav-dot ${activeDot === 'solution' ? 'active' : ''}`} style={{ transform: 'translateX(17px)' }}><span className="dot" data-label="The Solution">IV</span></a>
        <a href="#about" className={`nav-dot ${activeDot === 'about' ? 'active' : ''}`} style={{ transform: 'translateX(21px)' }}><span className="dot" data-label="About Us">V</span></a>
        <a href="#about-page" className={`nav-dot ${activeDot === 'about-page' ? 'active' : ''}`} style={{ transform: 'translateX(24px)' }}><span className="dot" data-label="About">VI</span></a>
        <a href="#vision-page" className={`nav-dot ${activeDot === 'vision-page' ? 'active' : ''}`} style={{ transform: 'translateX(26px)' }}><span className="dot" data-label="Vision">VII</span></a>
        <a href="#download" className={`nav-dot ${activeDot === 'download' ? 'active' : ''}`} style={{ transform: 'translateX(27px)' }}><span className="dot" data-label="Download">VIII</span></a>
        <a href="#client" className={`nav-dot ${activeDot === 'client' ? 'active' : ''}`} style={{ transform: 'translateX(27px)' }}><span className="dot" data-label="Seekers">IX</span></a>
        <a href="#tasker" className={`nav-dot ${activeDot === 'tasker' ? 'active' : ''}`} style={{ transform: 'translateX(26px)' }}><span className="dot" data-label="Professionals">X</span></a>
        <a href="#working" className={`nav-dot ${activeDot === 'working' ? 'active' : ''}`} style={{ transform: 'translateX(24px)' }}><span className="dot" data-label="How It Works">XI</span></a>
        <a href="#waitlist" className={`nav-dot ${activeDot === 'waitlist' ? 'active' : ''}`} style={{ transform: 'translateX(21px)' }}><span className="dot" data-label="Waitlist">XII</span></a>
        <a href="#faq" className={`nav-dot ${activeDot === 'faq' ? 'active' : ''}`} style={{ transform: 'translateX(17px)' }}><span className="dot" data-label="FAQ">XIII</span></a>
        <a href="#terms-page" className={`nav-dot ${activeDot === 'terms-page' ? 'active' : ''}`} style={{ transform: 'translateX(13px)' }}><span className="dot" data-label="Terms">XIV</span></a>
        <a href="#privacy-page" className={`nav-dot ${activeDot === 'privacy-page' ? 'active' : ''}`} style={{ transform: 'translateX(8px)' }}><span className="dot" data-label="Privacy">XV</span></a>
        <a href="#footer" className={`nav-dot ${activeDot === 'footer' ? 'active' : ''}`} style={{ transform: 'translateX(4px)' }}><span className="dot" data-label="Footer">XVI</span></a>
      </nav>

      {/* FIXED NAVBAR */}
      <nav className="fixed top-0 left-0 w-full h-20 bg-[#0B0C12]/80 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between">
          <a href="#hero" className="flex items-center gap-2.5">
            <img src="/logo.JPEG" alt="MaintainEX" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-extrabold text-xl tracking-tight"><span className="text-white">Maintain</span><span className="text-brand">EX</span></span>
          </a>
          <ul className="hidden md:flex items-center gap-8">
            <li><a href="#hero" className="text-white hover:text-brand transition font-medium">Home</a></li>
            <li><a href="#features" className="text-white hover:text-brand transition font-medium">Services</a></li>
            <li><a href="#working" className="text-white hover:text-brand transition font-medium">How It Works</a></li>
            <li><a href="#about-page" className="text-white hover:text-brand transition font-medium">About</a></li>
            <li><a href="#vision-page" className="text-white hover:text-brand transition font-medium">Vision</a></li>
          </ul>
          <a href="#waitlist" className="hidden md:inline-block bg-brand text-black py-3 px-7 rounded-full font-bold text-sm hover:bg-white hover:-translate-y-0.5 hover:shadow-lg transition-all">Join Waitlist</a>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden flex flex-col justify-center items-center gap-[5px] w-10 h-10 focus:outline-none">
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'translate-y-[7px] rotate-45' : ''}`}></span>
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-6 h-[2px] bg-white transition-all duration-300 ${mobileOpen ? '-translate-y-[7px] -rotate-45' : ''}`}></span>
          </button>
        </div>
        <div className={`md:hidden bg-[#0B0C12]/95 backdrop-blur-md border-t border-white/10 flex flex-col items-center gap-5 py-6 transition-all duration-300 overflow-hidden ${mobileOpen ? 'max-h-[400px]' : 'max-h-0'}`}>
          <a href="#hero" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Home</a>
          <a href="#features" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Services</a>
          <a href="#working" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">How It Works</a>
          <a href="#about-page" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">About</a>
          <a href="#vision-page" onClick={() => setMobileOpen(false)} className="text-white text-lg hover:text-brand transition">Vision</a>
          <a href="#waitlist" onClick={() => setMobileOpen(false)} className="bg-brand text-black font-semibold py-3 px-6 rounded-full">Join Waitlist</a>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" className="min-h-screen bg-[#0B0C12] relative overflow-hidden flex flex-col items-center justify-start">
        <div className="max-w-[1400px] mx-auto px-6 pt-[120px] flex flex-col items-center text-center relative z-10">
          <div className="inline-flex items-center px-3 sm:px-5 py-2 rounded-full bg-[#1a1b24] border border-white/10 mb-6 sm:mb-8">
            <div className="flex -space-x-3">
              <img src="https://i.pravatar.cc/40?img=11" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-[#0B0C12] bg-pink-200" alt="" />
              <img src="https://i.pravatar.cc/40?img=12" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-[#0B0C12] bg-yellow-200" alt="" />
              <img src="https://i.pravatar.cc/40?img=13" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 border-[#0B0C12] bg-emerald-200" alt="" />
            </div>
            <span className="ml-2 sm:ml-3 text-white text-xs sm:text-sm font-medium">Trusted by 500+ users</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight text-white mb-4 sm:mb-6 tracking-tight max-w-4xl fade-in-up">
            Hire someone who<br /><span className="text-brand">actually shows up.</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-xl mb-5 sm:mb-6 fade-in-up px-2">
            Connect with verified professionals for any task — home, business, or local.
            <span className="relative inline-block font-bold bg-animate px-1">Fast &amp; reliable.</span>
          </p>
          <div className="flex items-center gap-2 sm:gap-3 mb-8 sm:mb-10 fade-in-up">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1a1b24] border border-white/10 rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-xs sm:text-sm text-gray-300">Sri Lanka</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1a1b24] border border-white/10 rounded-full px-3 sm:px-4 py-1.5 sm:py-2">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="text-xs sm:text-sm text-gray-300">Canada</span>
            </div>
          </div>
          <a href="#waitlist" onClick={() => launchConfetti()} className="bg-white text-black py-3 sm:py-4 px-8 sm:px-12 rounded-full font-bold text-base sm:text-lg glow-amber hover:-translate-y-1 transition mb-5 sm:mb-6">
            Join Waitlist
          </a>
          <div className="flex items-center gap-4 mb-10">
            <span className="flex items-center gap-2 text-gray-400 text-sm font-medium">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="1"/></svg>
              App Available For
            </span>
            <div className="flex items-center bg-[#1a1b24] rounded-full px-5 py-2 border border-white/10 gap-3">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <span className="w-px h-6 bg-gray-600 rounded"></span>
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.73c.72.45 1.58.27 2.15-.26l15.2-8.76c.58-.33.95-.95.95-1.64 0-.69-.37-1.31-.95-1.64L5.33.4C4.76-.13 3.9-.31 3.18.14A1.63 1.63 0 002.26 1.6v20.74c0 .57.24 1.1.65 1.48l.27.01zM14.35 15.01l-2.66 1.54 2.66 1.54 2.93-1.69-2.93-1.39zM5.33 1.85L17.74 9.04l-2.93 1.69L5.33 1.85zm0 20.24l9.48-5.79-2.66-1.54L5.33 22.1l-.04-.01z"/></svg>
            </div>
          </div>
        </div>
        <div className="relative w-full max-w-[1400px] flex justify-center items-end mt-4">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex justify-between w-full px-[8vw] z-0 pointer-events-none select-none">
            <div className="relative hidden md:block w-[20vw] min-w-[200px] max-w-[280px] -rotate-[10deg] slow-float">
              <div className="relative bg-black rounded-[36px] p-[3px] shadow-2xl" style={{ boxShadow: '0 0 40px rgba(245,158,11,0.15), 0 25px 50px rgba(0,0,0,0.5)' }}>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[40%] h-[22px] bg-black rounded-b-2xl z-10"></div>
                <img src="/app-splash.png" className="w-full rounded-[33px] block" alt="MaintainEX App" />
              </div>
              <div className="absolute inset-0 rounded-[36px]" style={{ background: 'linear-gradient(to bottom,rgba(11,12,18,0) 40%,rgba(11,12,18,1) 100%)' }}></div>
            </div>
            <div className="relative hidden md:block w-[20vw] min-w-[200px] max-w-[280px] rotate-[10deg] slow-float" style={{ animationDelay: '1s' }}>
              <div className="relative bg-black rounded-[36px] p-[3px] shadow-2xl" style={{ boxShadow: '0 0 40px rgba(245,158,11,0.15), 0 25px 50px rgba(0,0,0,0.5)' }}>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[40%] h-[22px] bg-black rounded-b-2xl z-10"></div>
                <img src="/app-splash.png" className="w-full rounded-[33px] block" alt="MaintainEX App" />
              </div>
              <div className="absolute inset-0 rounded-[36px]" style={{ background: 'linear-gradient(to bottom,rgba(11,12,18,0) 40%,rgba(11,12,18,1) 100%)' }}></div>
            </div>
          </div>
          <div className="relative z-10 w-[280px] md:w-[320px] slow-float" style={{ animationDelay: '0.5s' }}>
            <div className="relative bg-black rounded-[44px] p-[4px] shadow-2xl" style={{ boxShadow: '0 0 80px rgba(245,158,11,0.2), 0 30px 60px rgba(0,0,0,0.6)' }}>
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[35%] h-[26px] bg-black rounded-b-2xl z-10"></div>
              <img src="/app-splash.png" className="w-full rounded-[40px] block" alt="MaintainEX App" />
            </div>
            <div className="absolute inset-0 rounded-[44px]" style={{ background: 'linear-gradient(to bottom,rgba(11,12,18,0) 50%,rgba(11,12,18,1) 100%)' }}></div>
          </div>
        </div>
        <div className="w-full bg-[#0B0C12] py-6 overflow-hidden relative">
          <div className="pointer-events-none absolute top-0 left-0 h-full w-32 z-10" style={{ background: 'linear-gradient(to right,#0B0C12,transparent)' }}></div>
          <div className="pointer-events-none absolute top-0 right-0 h-full w-32 z-10" style={{ background: 'linear-gradient(to left,#0B0C12,transparent)' }}></div>
          <div className="scroll-inner flex items-center gap-10 whitespace-nowrap text-gray-300 text-xl font-semibold select-none">
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> fast</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> reliable</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> verified</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> insured</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> transparent</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> rated</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> secure</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> tracked</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> fast</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> reliable</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> verified</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> insured</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> transparent</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> rated</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> secure</span>
            <span className="flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> tracked</span>
          </div>
        </div>
      </section>

      {/* CORE MESSAGE */}
      <section id="message" className="w-full bg-[#0B0C12] py-20 px-4 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center w-full my-8">
          <span className="flex items-center px-7 py-2 rounded-full bg-[#1a1b24] border border-white/10 text-sm font-semibold text-white">
            <svg className="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Why MaintainEX
          </span>
        </div>
        <h2 className="text-white text-4xl sm:text-5xl md:text-6xl font-black text-center mb-10 md:mb-14 max-w-5xl tracking-tight">
          Tasks that need doing, <span className="text-brand">done right.</span>
        </h2>
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-row-3 gap-10 md:gap-0" data-aos="flip-right">
          <div className="flex flex-col items-center px-6">
            <span className="text-4xl md:text-5xl font-black text-white">10%</span>
            <span className="mt-2 text-gray-400 text-lg font-medium text-center">
              <span className="block text-brand font-bold">Platform Fee — That&apos;s It</span>
              Industry charges 15-25%. We charge 10%, deducted only when you pay.
            </span>
          </div>
          <div className="flex justify-center items-center"><div className="w-px h-16 bg-brand/40"></div></div>
          <div className="flex flex-col items-center px-6">
            <span className="text-4xl md:text-5xl font-black text-white">200+</span>
            <span className="mt-2 text-gray-400 text-lg font-medium text-center">
              <span className="block text-brand font-bold">Services Available</span>
              From cleaning to event planning, IT support to logistics — and more every week.
            </span>
          </div>
          <div className="flex justify-center items-center"><div className="w-px h-16 bg-brand/40"></div></div>
          <div className="flex flex-col items-center px-6">
            <span className="text-4xl md:text-5xl font-black text-white">&lt;100 min</span>
            <span className="mt-2 text-gray-400 text-lg font-medium text-center">
              <span className="block text-brand font-bold">Average Match Time</span>
              Post a job, get matched with a verified pro, and book — fast.
            </span>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section id="problem" className="min-h-screen flex flex-col justify-center items-center px-4 py-16 bg-[#0B0C12]">
        <div className="flex items-center justify-center w-full my-8">
          <span className="flex items-center px-7 py-2 rounded-full bg-[#1a1b24] border border-white/10 text-sm font-semibold text-white">
            <svg className="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            The Problem
          </span>
        </div>
        <h2 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-center mb-8 md:mb-12 leading-tight max-w-5xl">
          Finding reliable help<br />shouldn&apos;t be <span className="text-brand">this hard.</span>
        </h2>
        <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl mb-12">
          <div className="flex-1 glass-card p-8" data-aos="zoom-in-right">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-brand/20">
                <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <span className="text-brand font-semibold text-xl">Seekers</span>
            </div>
            <p className="text-gray-300 text-lg leading-relaxed">Struggling to find reliable professionals for any task — personal, business, or local. No-shows, overcharging, and no accountability.</p>
          </div>
          <div className="flex-1 glass-card p-8" data-aos="zoom-in-left">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-10 h-10 flex items-center justify-center rounded-full bg-brand/20">
                <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              </div>
              <span className="text-brand font-semibold text-xl">Professionals</span>
            </div>
            <p className="text-gray-300 text-lg leading-relaxed">Facing exploitative platform fees, fake promises, and zero visibility into job opportunities near them.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 w-full max-w-5xl">
          <div className="glass-card p-6 flex flex-col items-center text-center group hover:scale-105 transition-transform duration-300" data-aos="zoom-in">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-brand/10 mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
            <span className="font-semibold text-lg text-white">Slow, outdated hiring processes.</span>
          </div>
          <div className="glass-card p-6 flex flex-col items-center text-center group hover:scale-105 transition-transform duration-300" data-aos="zoom-in">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-brand/10 mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
            <span className="font-semibold text-lg text-white">Overpriced &amp; hidden fees.</span>
          </div>
          <div className="glass-card p-6 flex flex-col items-center text-center group hover:scale-105 transition-transform duration-300" data-aos="zoom-in">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-brand/10 mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <span className="font-semibold text-lg text-white">No accountability or trust signals.</span>
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section id="solution" className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-[#0B0C12]">
        <div className="flex items-center justify-center w-full my-8">
          <span className="flex items-center px-7 py-2 rounded-full bg-[#1a1b24] border border-white/10 text-sm font-semibold text-white">
            <svg className="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            The Solution
          </span>
        </div>
        <div className="w-full max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-12 items-center" data-aos="fade-up">
          <div>
            <h2 className="text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 md:mb-6">Simple.<br /><span className="text-brand">Direct.</span><br />Trusted.</h2>
          </div>
          <div className="flex justify-center slow-float">
            <img src="https://placehold.co/400x500/15161E/F59E0B?text=MaintainEX+App" className="w-full max-w-md rounded-3xl shadow-2xl border-2 border-white/10 hover:scale-105 transition-transform duration-300" alt="" />
          </div>
        </div>
        <h2 className="text-white text-3xl sm:text-4xl md:text-5xl font-black text-center mb-10 md:mb-16 max-w-5xl">
          MaintainEX makes getting tasks done<br /><span className="text-brand">effortless.</span>
        </h2>
        <div className="w-full max-w-6xl mx-auto relative hidden md:block">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-700"></div>
          <div className="flex justify-between relative z-10">
            <div className="flex flex-col items-center w-1/5" data-aos="fade-up"><span className="text-4xl font-black text-white/10 mb-4">01</span><div className="w-3 h-3 bg-brand rounded-full mb-4"></div><div className="text-center"><div className="font-semibold text-sm mb-1">Search service</div><div className="text-xs text-gray-500">Tell us what you need.</div></div></div>
            <div className="flex flex-col items-center w-1/5" data-aos="fade-up" data-aos-delay="100"><span className="text-4xl font-black text-white/10 mb-4">02</span><div className="w-3 h-3 bg-brand rounded-full mb-4"></div><div className="text-center"><div className="font-semibold text-sm mb-1">Choose a pro</div><div className="text-xs text-gray-500">Browse verified experts.</div></div></div>
            <div className="flex flex-col items-center w-1/5" data-aos="fade-up" data-aos-delay="200"><span className="text-4xl font-black text-white/10 mb-4">03</span><div className="w-3 h-3 bg-brand rounded-full mb-4"></div><div className="text-center"><div className="font-semibold text-sm mb-1">Book &amp; pay</div><div className="text-xs text-gray-500">Secure in-app payment.</div></div></div>
            <div className="flex flex-col items-center w-1/5" data-aos="fade-up" data-aos-delay="300"><span className="text-4xl font-black text-white/10 mb-4">04</span><div className="w-3 h-3 bg-brand rounded-full mb-4"></div><div className="text-center"><div className="font-semibold text-sm mb-1">Job gets done</div><div className="text-xs text-gray-500">Track in real-time.</div></div></div>
            <div className="flex flex-col items-center w-1/5" data-aos="fade-up" data-aos-delay="400"><span className="text-4xl font-black text-white/10 mb-4">05</span><div className="w-3 h-3 bg-brand rounded-full mb-4"></div><div className="text-center"><div className="font-semibold text-sm mb-1">Rate &amp; review</div><div className="text-xs text-gray-500">Share your experience.</div></div></div>
          </div>
        </div>
        <div className="w-full max-w-md mx-auto md:hidden mt-8 space-y-4">
          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10" data-aos="fade-up"><span className="text-2xl font-black text-brand/40">01</span><div><div className="font-semibold text-white">Search service</div><div className="text-sm text-gray-400">Tell us what you need.</div></div></div>
          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10" data-aos="fade-up" data-aos-delay="100"><span className="text-2xl font-black text-brand/40">02</span><div><div className="font-semibold text-white">Choose a pro</div><div className="text-sm text-gray-400">Browse verified experts.</div></div></div>
          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10" data-aos="fade-up" data-aos-delay="200"><span className="text-2xl font-black text-brand/40">03</span><div><div className="font-semibold text-white">Book &amp; pay</div><div className="text-sm text-gray-400">Secure in-app payment.</div></div></div>
          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10" data-aos="fade-up" data-aos-delay="300"><span className="text-2xl font-black text-brand/40">04</span><div><div className="font-semibold text-white">Job gets done</div><div className="text-sm text-gray-400">Track in real-time.</div></div></div>
          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10" data-aos="fade-up" data-aos-delay="400"><span className="text-2xl font-black text-brand/40">05</span><div><div className="font-semibold text-white">Rate &amp; review</div><div className="text-sm text-gray-400">Share your experience.</div></div></div>
        </div>
        <div className="w-fit mx-auto px-6 py-8 mt-10">
          <div className="text-white py-10 text-2xl sm:text-3xl font-black tracking-tight text-center">
            10% Success Fee<br /><br />
            <span className="text-brand">Professionals keep what they earn</span>, and seekers save more.
            <span className="block mx-auto mt-3 h-[2px] w-16 bg-brand rounded-full animate-miniline"></span>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about">
        <div className="flex items-center justify-center w-full my-8">
          <span className="flex items-center px-7 py-2 rounded-full bg-[#1a1b24] border border-white/10 text-sm font-semibold text-white">
            <svg className="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            About Us
          </span>
        </div>
        <div className="w-full h-[50vh] bg-[#0B0C12]" style={{ backgroundImage: "url('https://placehold.co/1400x600/15161E/F59E0B?text=MaintainEX')", backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
        <div className="py-16 px-6 md:px-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-sm uppercase tracking-widest text-brand mb-8 font-light">Our Mission</h2>
            <p className="text-3xl md:text-5xl lg:text-6xl font-light leading-relaxed">
              To empower every <span className="font-semibold text-brand">seeker</span> with reliable access to
              <span className="font-semibold text-white"> trusted professionals</span> — <span className="text-white">anytime, anywhere.</span>
            </p>
          </div>
        </div>
        <div className="py-24 px-6 md:px-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-sm uppercase tracking-widest text-brand mb-8 font-light">Our Vision</h2>
            <p className="text-3xl md:text-5xl lg:text-6xl font-light leading-relaxed">
              To build the world&apos;s most <span className="font-semibold text-brand">trusted and transparent</span> task marketplace
              network — connecting <span className="font-semibold text-white">people, skills, and opportunity</span> through our platform.
            </p>
          </div>
        </div>
      </section>

      {/* APP DOWNLOAD */}
      <section id="download" className="relative flex flex-col-reverse md:flex-row items-center justify-between px-6 md:px-16 py-10 md:py-24 max-w-7xl mx-auto bg-brand rounded-3xl shadow-lg mx-4 md:mx-auto">
        <div className="w-full md:w-1/2 mt-10 md:mt-0 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 text-black">Start with MaintainEX today.</h1>
          <p className="text-black/80 text-lg md:text-xl mb-10 leading-relaxed">Book professionals from your phone. Verified pros, transparent pricing, guaranteed satisfaction.</p>
          <div className="flex flex-col sm:flex-row items-center sm:justify-start gap-5">
            <a href="#" className="bg-black text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-3 hover:opacity-90 transition">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              <div><div className="text-[10px] leading-none opacity-70">Download on the</div><div className="font-bold text-sm">App Store</div></div>
            </a>
            <a href="#" className="bg-black text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-3 hover:opacity-90 transition">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.73c.72.45 1.58.27 2.15-.26l15.2-8.76c.58-.33.95-.95.95-1.64 0-.69-.37-1.31-.95-1.64L5.33.4C4.76-.13 3.9-.31 3.18.14A1.63 1.63 0 002.26 1.6v20.74c0 .57.24 1.1.65 1.48l.27.01zM14.35 15.01l-2.66 1.54 2.66 1.54 2.93-1.69-2.93-1.39zM5.33 1.85L17.74 9.04l-2.93 1.69L5.33 1.85zm0 20.24l9.48-5.79-2.66-1.54L5.33 22.1l-.04-.01z"/></svg>
              <div><div className="text-[10px] leading-none opacity-70">Get it on</div><div className="font-bold text-sm">Google Play</div></div>
            </a>
          </div>
        </div>
        <div className="w-full md:w-1/2 flex items-center justify-center">
          <img src="https://placehold.co/400x400/15161E/F59E0B?text=MaintainEX" className="w-[220px] sm:w-[280px] md:w-[380px] rounded-3xl" alt="" />
        </div>
      </section>

      {/* SEEKER */}
      <section id="client" className="min-h-screen flex flex-col items-center justify-center px-6 py-20 md:py-32">
        <div className="flex items-center justify-center w-full my-8">
          <span className="flex items-center px-7 py-2 rounded-full bg-[#1a1b24] border border-white/10 text-sm font-semibold text-white">
            <svg className="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            For Seekers
          </span>
        </div>
        <div className="max-w-4xl text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">Get tasks done in <span className="text-brand">minutes</span>, not days.</h1>
          <p className="text-gray-300 text-lg md:text-xl mb-10">Need help with any task — personal, business, or local? MaintainEX connects you with verified professionals who get it done — <span className="relative inline-block font-bold bg-animate px-1">instantly</span>.</p>
          <div className="grid md:grid-cols-2 gap-8 text-left max-w-3xl mx-auto mb-12">
            <div className="pl-8 border-l border-gray-700"><h3 className="font-bold text-lg mb-1 flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Describe your task</h3><p className="text-gray-400">Tell us what you need done — personal, business, or local.</p></div>
            <div className="pl-8 border-l border-gray-700"><h3 className="font-bold text-lg mb-1 flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Choose a pro</h3><p className="text-gray-400">Browse verified experts with real reviews.</p></div>
            <div className="pl-8 border-l border-gray-700"><h3 className="font-bold text-lg mb-1 flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Book &amp; pay</h3><p className="text-gray-400">Secure payment, transparent pricing.</p></div>
            <div className="pl-8 border-l border-gray-700"><h3 className="font-bold text-lg mb-1 flex items-center gap-2"><svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Task completed</h3><p className="text-gray-400">Track in real-time, satisfaction guaranteed.</p></div>
          </div>
          <div className="w-24 h-[1px] bg-gray-700 mx-auto mb-12"></div>
          <h2 className="text-2xl font-semibold mb-6 text-brand">Key Benefits</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto text-center mb-10 md:mb-12">
            <div className="p-4 border border-gray-700 rounded-2xl hover:border-brand transition"><svg className="w-6 h-6 text-brand mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p className="font-bold text-lg">Verified Pros</p><p className="text-sm text-gray-400 mt-1">Background-checked &amp; insured</p></div>
            <div className="p-4 border border-gray-700 rounded-2xl hover:border-brand transition"><svg className="w-6 h-6 text-brand mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><p className="font-bold text-lg">Transparent Pricing</p><p className="text-sm text-gray-400 mt-1">No hidden fees ever</p></div>
            <div className="p-4 border border-gray-700 rounded-2xl hover:border-brand transition"><svg className="w-6 h-6 text-brand mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg><p className="font-bold text-lg">Real-Time Tracking</p><p className="text-sm text-gray-400 mt-1">Watch your pro on the way</p></div>
            <div className="p-4 border border-gray-700 rounded-2xl hover:border-brand transition"><svg className="w-6 h-6 text-brand mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><p className="font-bold text-lg">100% Guaranteed</p><p className="text-sm text-gray-400 mt-1">Or your money back</p></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a href="#waitlist" className="bg-brand text-black font-semibold px-8 py-3 rounded-full shadow glow-amber hover:-translate-y-0.5 transition">Join as Seeker</a>
            <a href="#" className="bg-white text-black font-semibold px-10 py-3 rounded-full shadow hover:bg-brand transition">Learn More &rarr;</a>
          </div>
        </div>
      </section>

      {/* PROFESSIONAL */}
      <section id="tasker" className="bg-[#0B0C12] text-white py-20 px-4 md:px-10 lg:px-24 flex flex-col items-center">
        <div className="flex items-center justify-center w-full my-8">
          <span className="flex items-center px-7 py-2 rounded-full bg-[#1a1b24] border border-white/10 text-sm font-semibold text-white">
            <svg className="w-5 h-5 mr-2 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            For Taskers
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-center mb-4 leading-tight">Skip the chasing.</h2>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-center mb-6 leading-tight"><span className="text-brand">Get paid for real work.</span></h2>
        <div className="max-w-2xl text-center mb-10">
          <p className="text-lg md:text-xl mb-2">MaintainEX gives you full visibility of nearby tasks and job opportunities.</p>
          <p className="text-lg md:text-xl text-gray-300">No agencies, no false promises — just fair work at your fingertips.</p>
        </div>
        <div className="w-full max-w-3xl flex flex-col items-center mb-12">
          <h3 className="text-brand text-sm uppercase tracking-widest font-bold mb-5">How it works</h3>
          <ol className="space-y-7 text-left">
            <li className="flex items-start gap-3"><span className="text-brand text-lg font-bold mt-1">1.</span><span>Get notified instantly when a seeker posts a nearby task.</span></li>
            <li className="flex items-start gap-3"><span className="text-brand text-lg font-bold mt-1">2.</span><span>Request to join the job that fits your skill and timing.</span></li>
            <li className="flex items-start gap-3"><span className="text-brand text-lg font-bold mt-1">3.</span><span>Get confirmed and show up.</span></li>
            <li className="flex items-start gap-3"><span className="text-brand text-lg font-bold mt-1">4.</span><span>Complete the work and get paid — <span className="font-bold text-white">100% yours.</span></span></li>
          </ol>
        </div>
        <div className="w-full max-w-3xl mb-8">
          <h3 className="text-brand text-sm uppercase tracking-widest font-bold mb-5 text-center">Key benefits</h3>
          <ul className="grid gap-4 md:grid-cols-2 text-base">
            <li className="border border-brand/40 rounded-lg py-3 px-5 flex items-center gap-3 bg-brand/10"><svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span><span className="text-brand font-bold">10% Success Fee</span> (you get what you earn)</span></li>
            <li className="border border-brand/40 rounded-lg py-3 px-5 flex items-center gap-3 bg-brand/10"><svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>Nearby jobs, updated in real time</li>
            <li className="border border-brand/40 rounded-lg py-3 px-5 flex items-center gap-3 bg-brand/10"><svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Reliable payments and verified seekers</li>
            <li className="border border-brand/40 rounded-lg py-3 px-5 flex items-center gap-3 bg-brand/10"><svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Freedom to choose your work</li>
          </ul>
        </div>
        <div className="mt-12 flex flex-col sm:flex-row gap-6 justify-center">
          <a href="#waitlist" onClick={() => launchConfetti()} className="bg-brand text-black font-semibold px-8 py-3 rounded-full shadow glow-amber hover:-translate-y-0.5 transition">Join as Tasker</a>
          <a href="#" className="bg-white text-black font-semibold px-10 py-3 rounded-full shadow hover:bg-brand transition">Learn More &rarr;</a>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="working" className="relative bg-[#0B0C12] py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-brand/5"></div>
        <div className="relative z-10 px-4 sm:px-8 py-16">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">How MaintainEX Works</h2>
              <div className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-brand/10 border border-brand/30 rounded-full">
                <span className="text-white/90 text-sm font-medium">Simple, fast, and transparent</span>
              </div>
              <p className="text-xl text-white/80 max-w-2xl mx-auto mt-6 font-light">From task to done — all in one tap.</p>
            </div>
            <div className="relative">
              <div className="absolute left-8 lg:left-1/2 lg:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-brand/40 to-white/20 hidden sm:block"></div>
              <div className="space-y-12">
                <div className="relative flex items-center" data-aos="fade-up">
                  <div className="flex-1 sm:pl-20 lg:pl-16">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 hover:bg-white/10 hover:border-brand/30 transition-all duration-300 group">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                        <div><div className="flex items-center gap-3 mb-2"><span className="text-5xl font-bold text-white/5 group-hover:text-white/10 transition">01</span><h3 className="text-2xl font-bold text-white">Search</h3></div><p className="text-white/70">Describe what you need — our AI finds the right pro.</p></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 w-8 h-8 rounded-full bg-brand border-4 border-[#0B0C12] flex items-center justify-center hidden sm:flex z-10"><span className="text-black font-bold text-xs">1</span></div>
                </div>
                <div className="relative flex items-center lg:flex-row-reverse" data-aos="fade-up">
                  <div className="flex-1 lg:text-right lg:pr-16 sm:pl-20 lg:pl-16">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 hover:bg-white/10 hover:border-brand/30 transition-all duration-300 group">
                      <div className="flex items-start gap-4 lg:flex-row-reverse lg:text-right">
                        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
                        <div><div className="flex items-center gap-3 mb-2 lg:flex-row-reverse"><span className="text-5xl font-bold text-white/5 group-hover:text-white/10 transition">02</span><h3 className="text-2xl font-bold text-white">Choose</h3></div><p className="text-white/70">Browse verified professionals with real reviews.</p></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 w-8 h-8 rounded-full bg-brand border-4 border-[#0B0C12] flex items-center justify-center hidden sm:flex z-10"><span className="text-black font-bold text-xs">2</span></div>
                </div>
                <div className="relative flex items-center" data-aos="fade-up">
                  <div className="flex-1 sm:pl-20 lg:pl-16">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 hover:bg-white/10 hover:border-brand/30 transition-all duration-300 group">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                        <div><div className="flex items-center gap-3 mb-2"><span className="text-5xl font-bold text-white/5 group-hover:text-white/10 transition">03</span><h3 className="text-2xl font-bold text-white">Book</h3></div><p className="text-white/70">Schedule at your convenience, pay securely in-app.</p></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 w-8 h-8 rounded-full bg-brand border-4 border-[#0B0C12] flex items-center justify-center hidden sm:flex z-10"><span className="text-black font-bold text-xs">3</span></div>
                </div>
                <div className="relative flex items-center lg:flex-row-reverse" data-aos="fade-up">
                  <div className="flex-1 lg:text-right lg:pr-16 sm:pl-20 lg:pl-16">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 hover:bg-white/10 hover:border-brand/30 transition-all duration-300 group">
                      <div className="flex items-start gap-4 lg:flex-row-reverse lg:text-right">
                        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
                        <div><div className="flex items-center gap-3 mb-2 lg:flex-row-reverse"><span className="text-5xl font-bold text-white/5 group-hover:text-white/10 transition">04</span><h3 className="text-2xl font-bold text-white">Enjoy</h3></div><p className="text-white/70">Track your pro in real-time, enjoy your home.</p></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 w-8 h-8 rounded-full bg-brand border-4 border-[#0B0C12] flex items-center justify-center hidden sm:flex z-10"><span className="text-black font-bold text-xs">4</span></div>
                </div>
                <div className="relative flex items-center" data-aos="fade-up">
                  <div className="flex-1 sm:pl-20 lg:pl-16">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-8 hover:bg-white/10 hover:border-brand/30 transition-all duration-300 group">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
                        <div><div className="flex items-center gap-3 mb-2"><span className="text-5xl font-bold text-white/5 group-hover:text-white/10 transition">05</span><h3 className="text-2xl font-bold text-white">Review</h3></div><p className="text-white/70">Rate your experience, help others find great pros.</p></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute left-8 lg:left-1/2 lg:-translate-x-1/2 w-8 h-8 rounded-full bg-brand border-4 border-[#0B0C12] flex items-center justify-center hidden sm:flex z-10"><span className="text-black font-bold text-xs">5</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-4 bg-[#0B0C12]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Built for speed, trust, and control.</h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">MaintainEX empowers both seekers and professionals through instant matching, transparent pricing, and total control.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
            <div className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300" data-aos="zoom-in"><div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><h4 className="font-bold text-lg mb-1">AI Search</h4><p className="text-sm text-gray-400">Describe your issue, our AI finds the right pro.</p></div>
            <div className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300" data-aos="zoom-in" data-aos-delay="100"><div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h4 className="font-bold text-lg mb-1">Smart Scheduling</h4><p className="text-sm text-gray-400">Book instantly or schedule for later.</p></div>
            <div className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300" data-aos="zoom-in" data-aos-delay="200"><div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div><h4 className="font-bold text-lg mb-1">Secure Payments</h4><p className="text-sm text-gray-400">Pay through the app, funds held in escrow.</p></div>
            <div className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300" data-aos="zoom-in" data-aos-delay="300"><div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><h4 className="font-bold text-lg mb-1">Verified Pros</h4><p className="text-sm text-gray-400">Background-checked &amp; insured professionals.</p></div>
            <div className="glass-card p-6 text-center hover:scale-105 transition-transform duration-300" data-aos="zoom-in" data-aos-delay="400"><div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center mx-auto mb-3"><svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></div><h4 className="font-bold text-lg mb-1">Real-Time Tracking</h4><p className="text-sm text-gray-400">Watch your pro on the way to your door.</p></div>
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" className="py-20 px-4 bg-[#0B0C12]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Join the Waitlist</h2>
          <p className="text-lg text-gray-400 mb-10">Secure your spot for the MaintainEX launch. Early members get priority access.</p>
          <form className="space-y-4 max-w-xl mx-auto text-left" onSubmit={async (e) => {
            e.preventDefault()
            const form = e.target as HTMLFormElement
            const phone = (form.elements.namedItem('phone') as HTMLInputElement).value
            const emailInput = form.elements.namedItem('email') as HTMLInputElement
            const email = emailInput.value || undefined

            if (!/^\d{10}$/.test(phone)) {
              toast.error('Please enter a valid 10-digit phone number')
              return
            }

            try {
              const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, email })
              })
              const data = await res.json()
              if (!res.ok) {
                toast.error(data.error || 'Failed to join waitlist')
                return
              }
              launchConfetti()
              setModalVisible(true)
              form.reset()
            } catch {
              toast.error('Something went wrong. Please try again.')
            }
          }}>
            <input
              type="tel"
              name="phone"
              placeholder="Phone Number"
              required
              pattern="[0-9]{10}"
              maxLength={10}
              inputMode="numeric"
              className="w-full bg-[#1a1b24] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:border-brand focus:outline-none transition"
            />
            <input
              type="email"
              name="email"
              placeholder="Email (optional)"
              className="w-full bg-[#1a1b24] border border-white/10 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:border-brand focus:outline-none transition"
            />
            <button type="submit" className="w-full bg-brand text-black font-bold py-4 rounded-xl hover:bg-brand-light transition text-lg mt-4">Join the Waitlist</button>
            <p className="text-xs text-gray-500 text-center mt-3">No spam. Unsubscribe anytime. Join 500+ others already on the list.</p>
          </form>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 bg-[#0B0C12]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white text-center mb-8 md:mb-12">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqData.map((item, i) => (
              <div key={i} className="faq-item border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => toggleFaq(i)} className="faq-q w-full flex justify-between items-center px-6 py-5 text-left bg-[#1a1b24] hover:bg-[#1f2029] transition">
                  <span className="font-semibold text-white flex items-center gap-2">{getFaqIcon(i)} {item.q}</span>
                  <span className="text-brand text-2xl font-bold">{faqOpen === i ? '\u2212' : '+'}</span>
                </button>
                <div className="faq-a px-6" style={{ maxHeight: faqOpen === i ? '200px' : '0', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                  <p className="py-4 text-gray-400">{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT PAGE */}
      <section id="about-page" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <span className="text-brand text-sm uppercase tracking-widest font-bold">About MaintainEX</span>
          <h2 className="text-3xl md:text-4xl md:text-5xl font-black text-white mt-4 mb-4 md:mb-6">Built for the people who build the world.</h2>
          <p className="text-base md:text-xl text-gray-400 max-w-2xl mb-12 md:mb-16">We connect skilled professionals with people and businesses who need help getting things done — fast, fair, and transparently.</p>
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mb-16 md:mb-20">
            <div>
              <h3 className="text-2xl md:text-3xl font-black text-white mb-4 md:mb-6">It started with a simple problem.</h3>
              <p className="text-base md:text-lg text-gray-400 leading-relaxed mb-3 md:mb-4">We watched people struggle to find reliable help — for their homes, their businesses, and their daily lives. The existing solutions were slow, overpriced, and untrustworthy.</p>
              <p className="text-base md:text-lg text-gray-400 leading-relaxed mb-3 md:mb-4">Meanwhile, thousands of skilled professionals were looking for work but had no way to connect with the people who needed them.</p>
              <p className="text-base md:text-lg text-gray-400 leading-relaxed">MaintainEX was built to solve both sides of this problem. A marketplace that&apos;s fair for professionals and reliable for seekers.</p>
            </div>
            <div className="bg-[#15161E] border border-white/10 rounded-3xl p-6 md:p-10">
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-3 md:gap-4"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 md:w-6 md:h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><div><h4 className="font-bold text-white text-sm md:text-base">Trust by Default</h4><p className="text-xs md:text-sm text-gray-400">Every professional verified. Every review real.</p></div></div>
                <div className="flex items-center gap-3 md:gap-4"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 md:w-6 md:h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div><h4 className="font-bold text-white text-sm md:text-base">Fair Economics</h4><p className="text-xs md:text-sm text-gray-400">10% platform fee. Professionals keep 90%.</p></div></div>
                <div className="flex items-center gap-3 md:gap-4"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 md:w-6 md:h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><div><h4 className="font-bold text-white text-sm md:text-base">Instant Matching</h4><p className="text-xs md:text-sm text-gray-400">AI-powered. Under 100 minutes average.</p></div></div>
                <div className="flex items-center gap-3 md:gap-4"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand/10 flex items-center justify-center flex-shrink-0"><svg className="w-5 h-5 md:w-6 md:h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div><div><h4 className="font-bold text-white text-sm md:text-base">Global Local</h4><p className="text-xs md:text-sm text-gray-400">Starting in Sri Lanka &amp; Canada. Scaling worldwide.</p></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VISION & MISSION */}
      <section id="vision-page" className="py-20 px-6 bg-[#15161E]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mb-16 md:mb-20">
            <div>
              <span className="text-brand text-sm uppercase tracking-widest font-bold">Our Vision</span>
              <h2 className="text-3xl md:text-4xl md:text-5xl font-black text-white mt-4 mb-4 md:mb-6">The world&apos;s most trusted task marketplace.</h2>
              <p className="text-lg text-gray-400 leading-relaxed mb-4">We envision a world where anyone can get any task done — from home repairs to business operations — by connecting with verified, trusted professionals in their area.</p>
              <p className="text-lg text-gray-400 leading-relaxed">No more guesswork. No more no-shows. No more hidden fees. Just reliable professionals, transparent pricing, and guaranteed satisfaction.</p>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-brand/10 rounded-3xl blur-3xl"></div>
              <div className="relative bg-[#0B0C12] border border-white/10 rounded-3xl p-10">
                <div className="grid grid-cols-2 gap-3 md:gap-6">
                  <div className="text-center p-3 md:p-6 bg-[#1a1b24] rounded-2xl border border-white/5"><div className="text-2xl md:text-3xl font-black text-brand">2027</div><div className="text-xs md:text-sm text-gray-400 mt-1">Target Year</div></div>
                  <div className="text-center p-3 md:p-6 bg-[#1a1b24] rounded-2xl border border-white/5"><div className="text-2xl md:text-3xl font-black text-brand">10M+</div><div className="text-xs md:text-sm text-gray-400 mt-1">Tasks Completed</div></div>
                  <div className="text-center p-3 md:p-6 bg-[#1a1b24] rounded-2xl border border-white/5"><div className="text-2xl md:text-3xl font-black text-brand">50+</div><div className="text-xs md:text-sm text-gray-400 mt-1">Countries</div></div>
                  <div className="text-center p-3 md:p-6 bg-[#1a1b24] rounded-2xl border border-white/5"><div className="text-2xl md:text-3xl font-black text-brand">1M+</div><div className="text-xs md:text-sm text-gray-400 mt-1">Professionals</div></div>
                </div>
              </div>
            </div>
          </div>
          <span className="text-brand text-sm uppercase tracking-widest font-bold">Our Mission</span>
          <h2 className="text-3xl md:text-4xl md:text-5xl font-black text-white mt-4 mb-8 md:mb-12">Empowering every connection.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mb-16 md:mb-20">
            <div className="bg-[#0B0C12] border border-white/10 rounded-2xl p-5 md:p-8 hover:border-brand/30 transition-all"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-3 md:mb-4"><svg className="w-5 h-5 md:w-6 md:h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div><h3 className="text-base md:text-xl font-bold text-white mb-2 md:mb-3">Trust First</h3><p className="text-gray-400 text-sm md:text-base">Every professional is background-checked, ID-verified, and skill-assessed. We never compromise on trust.</p></div>
            <div className="bg-[#0B0C12] border border-white/10 rounded-2xl p-5 md:p-8 hover:border-brand/30 transition-all"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-3 md:mb-4"><svg className="w-5 h-5 md:w-6 md:h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><h3 className="text-base md:text-xl font-bold text-white mb-2 md:mb-3">Fair Pricing</h3><p className="text-gray-400 text-sm md:text-base">Transparent upfront pricing. No hidden fees. Professionals keep 90% of what they earn.</p></div>
            <div className="bg-[#0B0C12] border border-white/10 rounded-2xl p-5 md:p-8 hover:border-brand/30 transition-all"><div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-brand/10 flex items-center justify-center mb-3 md:mb-4"><svg className="w-5 h-5 md:w-6 md:h-6 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><h3 className="text-base md:text-xl font-bold text-white mb-2 md:mb-3">Instant Access</h3><p className="text-gray-400 text-sm md:text-base">AI-powered matching connects you with the right professional in under 100 minutes.</p></div>
          </div>
          <span className="text-brand text-sm uppercase tracking-widest font-bold">Core Values</span>
          <h2 className="text-2xl md:text-4xl font-black text-white mt-4 mb-8 md:mb-12">What drives us every day.</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            <div className="flex gap-4 md:gap-6 p-4 md:p-6 bg-[#0B0C12] border border-white/10 rounded-2xl hover:border-brand/30 transition-all"><div className="text-3xl md:text-4xl font-black text-brand/20">01</div><div><h3 className="text-lg md:text-xl font-bold text-white mb-2">Radical Transparency</h3><p className="text-gray-400 text-sm md:text-base">Every price, every review, every professional — visible and verified. No black boxes.</p></div></div>
            <div className="flex gap-4 md:gap-6 p-4 md:p-6 bg-[#0B0C12] border border-white/10 rounded-2xl hover:border-brand/30 transition-all"><div className="text-3xl md:text-4xl font-black text-brand/20">02</div><div><h3 className="text-lg md:text-xl font-bold text-white mb-2">People Over Profit</h3><p className="text-gray-400 text-sm md:text-base">We take 10% so professionals keep 90%. Fair fees build sustainable businesses.</p></div></div>
            <div className="flex gap-4 md:gap-6 p-4 md:p-6 bg-[#0B0C12] border border-white/10 rounded-2xl hover:border-brand/30 transition-all"><div className="text-3xl md:text-4xl font-black text-brand/20">03</div><div><h3 className="text-lg md:text-xl font-bold text-white mb-2">Speed Matters</h3><p className="text-gray-400 text-sm md:text-base">From search to booking in minutes. AI-powered matching eliminates wait times.</p></div></div>
            <div className="flex gap-4 md:gap-6 p-4 md:p-6 bg-[#0B0C12] border border-white/10 rounded-2xl hover:border-brand/30 transition-all"><div className="text-3xl md:text-4xl font-black text-brand/20">04</div><div><h3 className="text-lg md:text-xl font-bold text-white mb-2">Global Local</h3><p className="text-gray-400 text-sm md:text-base">Built for local communities, scaled globally. Starting in Sri Lanka &amp; Canada.</p></div></div>
          </div>
        </div>

        {/* INVESTORS */}
        <div id="investors-page" className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <span className="text-brand text-sm uppercase tracking-widest font-bold">Investor Relations</span>
            <h2 className="text-3xl md:text-4xl md:text-5xl font-black text-white mt-4 mb-4 md:mb-6">The future of work is on-demand.</h2>
            <p className="text-base md:text-xl text-gray-400 max-w-2xl mb-8 md:mb-12">MaintainEX is building the infrastructure that connects every task to the right professional — instantly, transparently, and fairly.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-16 md:mb-20 bg-[#15161E] rounded-3xl p-6 md:p-10">
              <div className="text-center"><div className="text-4xl font-black text-brand">$400B+</div><p className="text-gray-400 mt-2 text-sm">Total Addressable Market</p></div>
              <div className="text-center"><div className="text-4xl font-black text-brand">$87B</div><p className="text-gray-400 mt-2 text-sm">Serviceable Market (2026)</p></div>
              <div className="text-center"><div className="text-4xl font-black text-brand">10%</div><p className="text-gray-400 mt-2 text-sm">Platform Fee</p></div>
              <div className="text-center"><div className="text-4xl font-black text-brand">90%</div><p className="text-gray-400 mt-2 text-sm">Professional Retention</p></div>
            </div>
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 mb-16 md:mb-20">
              <div>
                <h3 className="text-2xl font-bold text-white mb-6">The Problem</h3>
                <div className="space-y-4">
                  <div className="flex gap-4 items-start"><div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-1"><svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><div><h4 className="font-bold text-white">Fragmented Market</h4><p className="text-gray-400 text-sm">Millions of informal workers with no digital presence.</p></div></div>
                  <div className="flex gap-4 items-start"><div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-1"><svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><div><h4 className="font-bold text-white">Trust Deficit</h4><p className="text-gray-400 text-sm">No verification, no reviews, no accountability.</p></div></div>
                  <div className="flex gap-4 items-start"><div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-1"><svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div><div><h4 className="font-bold text-white">Exploitative Fees</h4><p className="text-gray-400 text-sm">Existing platforms charge 15-25%, leaving professionals underpaid.</p></div></div>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-6">Our Solution</h3>
                <div className="space-y-4">
                  <div className="flex gap-4 items-start"><div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-1"><svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><div><h4 className="font-bold text-white">AI-Powered Matching</h4><p className="text-gray-400 text-sm">Match seekers with the right professional in under 100 minutes.</p></div></div>
                  <div className="flex gap-4 items-start"><div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-1"><svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><div><h4 className="font-bold text-white">Verified Trust Layer</h4><p className="text-gray-400 text-sm">Background checks, ID verification, real reviews.</p></div></div>
                  <div className="flex gap-4 items-start"><div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-1"><svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div><div><h4 className="font-bold text-white">Fair Economics</h4><p className="text-gray-400 text-sm">10% fee. Professionals keep 90%. Sustainable and scalable.</p></div></div>
                </div>
              </div>
            </div>
            <h3 className="text-xl md:text-3xl font-black text-white mb-6 md:mb-8">How we make money.</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 mb-16 md:mb-20">
              <div className="bg-[#15161E] border border-white/10 rounded-2xl p-5 md:p-8 hover:border-brand/30 transition-all"><div className="text-2xl md:text-3xl font-black text-brand mb-2">10%</div><h4 className="text-base md:text-xl font-bold text-white mb-2 md:mb-3">Platform Fee</h4><p className="text-gray-400 text-sm">Charged on every completed transaction. Professionals receive 90%.</p></div>
              <div className="bg-[#15161E] border border-white/10 rounded-2xl p-5 md:p-8 hover:border-brand/30 transition-all"><div className="text-2xl md:text-3xl font-black text-brand mb-2">Weekly</div><h4 className="text-base md:text-xl font-bold text-white mb-2 md:mb-3">Payouts</h4><p className="text-gray-400 text-sm">Professionals get paid weekly via bank transfer or mobile payment.</p></div>
              <div className="bg-[#15161E] border border-white/10 rounded-2xl p-5 md:p-8 hover:border-brand/30 transition-all"><div className="text-2xl md:text-3xl font-black text-brand mb-2">2x</div><h4 className="text-base md:text-xl font-bold text-white mb-2 md:mb-3">Network Effects</h4><p className="text-gray-400 text-sm">More professionals attract more seekers. Classic marketplace flywheel.</p></div>
            </div>
            <h3 className="text-xl md:text-3xl font-black text-white mb-6 md:mb-8">Traction &amp; Roadmap.</h3>
            <div className="space-y-8 mb-20">
              <div className="flex gap-6 items-start"><div className="flex flex-col items-center"><div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-black font-bold text-sm">Q1</div><div className="w-px h-16 bg-brand/30"></div></div><div className="bg-[#15161E] border border-white/10 rounded-xl p-6 flex-1"><span className="text-brand text-sm font-bold">Completed</span><h4 className="text-lg font-bold text-white mt-1">MVP Launch &amp; Waitlist</h4><p className="text-gray-400 text-sm mt-1">Platform built, 500+ waitlist signups, initial professional onboarding in Sri Lanka.</p></div></div>
              <div className="flex gap-6 items-start"><div className="flex flex-col items-center"><div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-black font-bold text-sm">Q2</div><div className="w-px h-16 bg-brand/30"></div></div><div className="bg-[#15161E] border border-white/10 rounded-xl p-6 flex-1"><span className="text-brand text-sm font-bold">In Progress</span><h4 className="text-lg font-bold text-white mt-1">Sri Lanka Beta Launch</h4><p className="text-gray-400 text-sm mt-1">Mobile app launch, 100+ professionals onboarded, first paying transactions.</p></div></div>
              <div className="flex gap-6 items-start"><div className="flex flex-col items-center"><div className="w-10 h-10 rounded-full bg-brand/30 flex items-center justify-center text-brand font-bold text-sm">Q3</div><div className="w-px h-16 bg-brand/10"></div></div><div className="bg-[#15161E] border border-white/10 rounded-xl p-6 flex-1"><span className="text-gray-400 text-sm font-bold">Planned</span><h4 className="text-lg font-bold text-white mt-1">Canada Expansion</h4><p className="text-gray-400 text-sm mt-1">Launch in Toronto &amp; Vancouver. Partnership with local service companies.</p></div></div>
              <div className="flex gap-6 items-start"><div className="flex flex-col items-center"><div className="w-10 h-10 rounded-full bg-brand/30 flex items-center justify-center text-brand font-bold text-sm">Q4</div></div><div className="bg-[#15161E] border border-white/10 rounded-xl p-6 flex-1"><span className="text-gray-400 text-sm font-bold">Planned</span><h4 className="text-lg font-bold text-white mt-1">Series A &amp; Regional Scale</h4><p className="text-gray-400 text-sm mt-1">Expand to 5+ countries. AI matching 2.0. Agency management platform.</p></div></div>
            </div>
            <div className="bg-[#15161E] border border-brand/20 rounded-3xl p-6 md:p-10">
              <h3 className="text-2xl md:text-3xl font-black text-white mb-4 md:mb-6">Invest in the future of work.</h3>
              <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
                <div className="bg-[#0B0C12] border border-white/10 rounded-2xl p-4 md:p-6 text-center"><div className="text-lg md:text-2xl font-black text-brand mb-1 md:mb-2">Pre-Seed</div><p className="text-gray-400 text-xs md:text-sm">Current Round</p></div>
                <div className="bg-[#0B0C12] border border-white/10 rounded-2xl p-4 md:p-6 text-center"><div className="text-lg md:text-2xl font-black text-brand mb-1 md:mb-2">$500K</div><p className="text-gray-400 text-xs md:text-sm">Raising Amount</p></div>
                <div className="bg-[#0B0C12] border border-white/10 rounded-2xl p-4 md:p-6 text-center"><div className="text-lg md:text-2xl font-black text-brand mb-1 md:mb-2">18 months</div><p className="text-gray-400 text-xs md:text-sm">Runway Target</p></div>
              </div>
              <h4 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Use of Funds</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-brand"></div><span className="text-gray-300">Mobile app development (iOS &amp; Android)</span></div>
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-brand"></div><span className="text-gray-300">AI matching engine development</span></div>
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-brand"></div><span className="text-gray-300">Sri Lanka market launch &amp; growth</span></div>
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-brand"></div><span className="text-gray-300">Canada expansion preparation</span></div>
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-brand"></div><span className="text-gray-300">Team hiring (engineering &amp; operations)</span></div>
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-brand"></div><span className="text-gray-300">Marketing &amp; professional onboarding</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TERMS & CONDITIONS */}
      <section id="terms-page" className="py-20 px-6 bg-[#15161E]">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-5 py-2 rounded-full bg-[#0B0C12] border border-white/10 text-sm font-semibold text-brand mb-6">Legal</span>
          <h2 className="text-3xl md:text-4xl md:text-5xl font-black text-white mb-4">Terms &amp; Conditions</h2>
          <p className="text-gray-400 mb-12">Last updated: January 2026</p>
          <div className="space-y-10 text-gray-300 leading-relaxed">
            <div><h3 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h3><p>By accessing or using the MaintainEX platform, you agree to be bound by these Terms. MaintainEX is a marketplace connecting seekers with professionals. We are not a party to any agreement between parties.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">2. Eligibility</h3><p>You must be at least 18 years old. Professionals must complete identity verification. Agencies must provide valid business registration documents.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">3. Platform Role</h3><p>MaintainEX acts as an intermediary. We connect seekers with professionals, process payments through escrow, and facilitate dispute resolution. We do not employ professionals directly.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">4. Fees &amp; Payments</h3><p className="mb-2"><strong className="text-brand">Seekers:</strong> 10% platform fee included in the total price shown.</p><p className="mb-2"><strong className="text-brand">Professionals:</strong> 10% success fee deducted before payout. Weekly payouts via bank transfer or mobile payment.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">5. Cancellations &amp; Refunds</h3><p>Cancel up to 24 hours before for a full refund. If a professional fails to show up or work is unsatisfactory, request a refund through our dispute resolution process.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">6. Prohibited Activities</h3><p>Users may not: use the platform for illegal activities, circumvent platform fees, provide false information, harass other users, or attempt unauthorized access.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">7. Limitation of Liability</h3><p>MaintainEX shall not be liable for indirect, incidental, or consequential damages. Our total liability shall not exceed fees paid in the 12 months preceding the claim.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">8. Contact</h3><p>For questions: <span className="text-brand">legal@maintainex.com</span></p></div>
          </div>
        </div>
      </section>

      {/* PRIVACY POLICY */}
      <section id="privacy-page" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-5 py-2 rounded-full bg-[#1a1b24] border border-white/10 text-sm font-semibold text-brand mb-6">Legal</span>
          <h2 className="text-3xl md:text-4xl md:text-5xl font-black text-white mb-4">Privacy Policy</h2>
          <p className="text-gray-400 mb-12">Last updated: January 2026</p>
          <div className="space-y-10 text-gray-300 leading-relaxed">
            <div><h3 className="text-xl font-bold text-white mb-3">1. Information We Collect</h3><p className="mb-2"><strong className="text-brand">Personal:</strong> Name, email, mobile number, government ID (for verification), payment info, location data.</p><p><strong className="text-brand">Usage:</strong> Device info, pages viewed, IP address, task history, reviews.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h3><p>To provide services, match seekers with professionals, process payments, verify identities, communicate updates, improve AI matching, prevent fraud, and comply with legal obligations.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">3. Information Sharing</h3><p>We share only as necessary: seeker-professional (for task completion), service providers (payment, hosting), legal requirements, and business transfers. We never sell your data to third parties.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">4. Data Security</h3><p>End-to-end encryption, SSL/TLS, regular security audits, access controls, and automated fraud detection.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">5. Data Retention</h3><p>Account data: until deletion. Task history: 5 years. Payment records: 7 years. Analytics: anonymized after 12 months.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">6. Your Rights</h3><p>Access, correct, delete your data. Opt out of communications. Withdraw consent. Lodge complaints with data protection authorities.</p></div>
            <div><h3 className="text-xl font-bold text-white mb-3">7. Contact</h3><p>Privacy inquiries: <span className="text-brand">privacy@maintainex.com</span></p></div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="footer" className="border-t border-white/10 bg-[#0B0C12]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 md:gap-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo.JPEG" alt="MaintainEX" className="w-8 h-8 rounded-full object-cover" />
                <span className="font-extrabold text-xl tracking-tight"><span className="text-white">Maintain</span><span className="text-brand">EX</span></span>
              </div>
              <p className="text-gray-400 text-sm max-w-xs mb-4">Your trusted task marketplace. Verified professionals, transparent pricing, 100% satisfaction guaranteed.</p>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                Sri Lanka &bull; Canada
              </div>
            </div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">Product</h4><a href="#" className="block text-gray-300 text-sm hover:text-brand transition py-1">Features</a><a href="#" className="block text-gray-300 text-sm hover:text-brand transition py-1">Pricing</a><a href="#" className="block text-gray-300 text-sm hover:text-brand transition py-1">Mobile App</a><a href="#" className="block text-gray-300 text-sm hover:text-brand transition py-1">Updates</a></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">Platform</h4><a href="#client" className="block text-gray-300 text-sm hover:text-brand transition py-1">For Seekers</a><a href="#tasker" className="block text-gray-300 text-sm hover:text-brand transition py-1">For Professionals</a><a href="#features" className="block text-gray-300 text-sm hover:text-brand transition py-1">Services</a><a href="#working" className="block text-gray-300 text-sm hover:text-brand transition py-1">How It Works</a></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">Company</h4><a href="#about-page" className="block text-gray-300 text-sm hover:text-brand transition py-1">About Us</a><a href="#vision-page" className="block text-gray-300 text-sm hover:text-brand transition py-1">Vision &amp; Mission</a><a href="#investors-page" className="block text-gray-300 text-sm hover:text-brand transition py-1">Investors</a><a href="#" className="block text-gray-300 text-sm hover:text-brand transition py-1">Careers</a></div>
            <div><h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-4">Legal</h4><a href="#terms-page" className="block text-gray-300 text-sm hover:text-brand transition py-1">Terms of Service</a><a href="#privacy-page" className="block text-gray-300 text-sm hover:text-brand transition py-1">Privacy Policy</a><a href="#" className="block text-gray-300 text-sm hover:text-brand transition py-1">Cookie Policy</a><a href="#" className="block text-gray-300 text-sm hover:text-brand transition py-1">Security</a></div>
          </div>
        </div>
        <div className="border-t border-white/10 py-6 px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-sm text-gray-500">&copy; 2026 MaintainEX. All rights reserved.</span>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-brand transition">Twitter</a>
              <a href="#" className="text-gray-400 hover:text-brand transition">Instagram</a>
              <a href="#" className="text-gray-400 hover:text-brand transition">LinkedIn</a>
              <a href="#" className="text-gray-400 hover:text-brand transition">WhatsApp</a>
            </div>
          </div>
        </div>
      </footer>

      {/* WHATSAPP FLOAT */}
      <a href="https://wa.me/1234567890" target="_blank" rel="noopener noreferrer" className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 hover:scale-110 transition-all">
        <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 1.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>

      {/* STICKY WAITLIST BANNER */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-brand/95 backdrop-blur-md py-2.5 sm:py-3 px-4 sm:px-6 flex items-center justify-between gap-3 transition-all duration-500 ${bannerVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
        <span className="text-black font-semibold text-xs sm:text-sm">Don&apos;t miss out — Join the waitlist!</span>
        <a href="#waitlist" className="bg-black text-white font-bold py-2 px-4 sm:px-6 rounded-full text-xs sm:text-sm hover:opacity-90 transition whitespace-nowrap">Join Now</a>
        <button onClick={() => setBannerVisible(false)} className="text-black/60 hover:text-black text-lg sm:text-xl font-bold flex-shrink-0">&times;</button>
      </div>

      {/* CONFETTI CONTAINER */}
      <div ref={confettiBoxRef} className="confetti-container"></div>

      {/* SUCCESS MODAL */}
      <div className={`modal-overlay ${modalVisible ? 'show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalVisible(false) }}>
        <div className="modal-card bg-[#1a1b24] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand animate-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">You&apos;re on the Waitlist!</h3>
          <p className="text-gray-400 mb-4">We&apos;ll notify you when we launch. Welcome aboard!</p>
          <div className="bg-[#0B0C12] rounded-xl p-4 mb-6">
            <p className="text-gray-400 text-sm">You&apos;re one of</p>
            <p className="text-3xl font-black text-brand">500+</p>
            <p className="text-gray-400 text-sm">early adopters shaping the future of work</p>
          </div>
          <button onClick={() => setModalVisible(false)} className="bg-brand text-black font-bold py-3 px-8 rounded-full w-full hover:bg-brand-light transition">Got it!</button>
        </div>
      </div>
    </>
  )
}
