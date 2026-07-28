'use client'

import Link from 'next/link'

export default function VisionContent() {
  return (
    <div className="min-h-screen bg-[#0B0C12]">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm mb-12 text-amber-500 hover:text-amber-400 transition-colors">
          ← Back to Home
        </Link>

        {/* Mission */}
        <section className="mb-20">
          <p className="text-sm font-semibold tracking-widest uppercase mb-4 text-amber-500">Our Mission</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white">
            One app. Every home service. Done right.
          </h1>
          <p className="text-lg leading-relaxed text-gray-400">
            We started MaintainEX because hiring someone for home tasks shouldn&apos;t feel like a gamble.
            Whether it&apos;s a leaky faucet, a deep clean, or a full renovation — you deserve someone who shows up on time,
            does quality work, and charges fairly. Our mission is to make that the norm, not the exception.
          </p>
        </section>

        {/* Vision 2027 */}
        <section className="mb-20">
          <p className="text-sm font-semibold tracking-widest uppercase mb-4 text-amber-500">Our Vision — 2027</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
            Every home in Sri Lanka &amp; Canada — one tap away from help
          </h2>
          <p className="text-lg leading-relaxed mb-8 text-gray-400">
            By 2027, we aim to be the #1 home services platform in both Sri Lanka and Canada.
            Not just an app — a trusted part of every household. When something breaks, needs fixing,
            or needs cleaning, MaintainEX should be the first name that comes to mind.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { number: '2027', label: 'Target Year', desc: 'Become #1 in both markets' },
              { number: '100K+', label: 'Verified Taskers', desc: 'Skilled professionals you can trust' },
              { number: '1M+', label: 'Jobs Completed', desc: 'Homes served across two countries' },
            ].map((stat, i) => (
              <div key={i} className="rounded-2xl p-6 text-center bg-[#15161E] border border-gray-800">
                <div className="text-3xl font-bold mb-2 text-amber-500">{stat.number}</div>
                <div className="text-sm font-semibold mb-1 text-white">{stat.label}</div>
                <div className="text-xs text-gray-400">{stat.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Core Values */}
        <section className="mb-20">
          <p className="text-sm font-semibold tracking-widest uppercase mb-4 text-amber-500">Core Values</p>
          <h2 className="text-3xl font-bold mb-8 text-white">What drives us</h2>

          <div className="space-y-6">
            {[
              { title: 'Trust Above All', desc: 'Every tasker is verified. Every job is tracked. Every payment is protected. Trust isn\'t optional — it\'s our foundation.' },
              { title: 'Local First', desc: 'We serve Jaffna, Colombo, Toronto, and every community in between. We understand local needs because we are local.' },
              { title: 'Fair Pricing', desc: 'No hidden fees. No surge pricing. Transparent quotes before you commit. 10% platform fee — that\'s it.' },
              { title: 'Quality Guarantee', desc: 'If the job isn\'t done right, we make it right. Our dispute resolution and escrow system protects both sides.' },
            ].map((value, i) => (
              <div key={i} className="rounded-2xl p-6 bg-[#15161E] border border-gray-800">
                <h3 className="text-lg font-bold mb-2 text-white">{value.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{value.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">Ready to join the future?</h2>
          <p className="mb-8 text-gray-400">
            Whether you need help at home or want to earn by helping others — we&apos;re building something special.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 bg-amber-500 text-black"
          >
            Get Started →
          </Link>
        </section>
      </div>
    </div>
  )
}
