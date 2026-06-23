import { Search, MessageSquareText, ShieldCheck } from 'lucide-react'

const STEPS = [
  {
    num: '01',
    icon: Search,
    title: 'Describe the job',
    desc: 'Tell us what you need — a leaking tap, a deep clean, or a website. Type it naturally, our AI handles the rest.',
  },
  {
    num: '02',
    icon: MessageSquareText,
    title: 'Get matched quotes',
    desc: 'Vetted taskers near you respond with their price and availability. Compare quotes side-by-side in minutes.',
  },
  {
    num: '03',
    icon: ShieldCheck,
    title: 'Pay when it\'s done',
    desc: 'Your payment sits in escrow until the job is completed to your satisfaction. No risk, no surprises.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase tracking-[0.15em] text-amber-600 font-semibold">How it works</span>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.03em] text-ink mt-3">
            Three steps.<br />
            <span className="text-muted-foreground">Zero awkward phone calls.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.num}
                className="group rounded-3xl bg-card border border-border p-8 transition-all duration-300"
              >
                <span className="text-5xl font-black text-amber-500/20 group-hover:text-amber-500/40 transition-colors">
                  {step.num}
                </span>
                <div className="size-12 rounded-2xl bg-amber-soft flex items-center justify-center mt-4 mb-5 group-hover:bg-amber-500 transition-colors duration-300">
                  <Icon className="w-6 h-6 text-ink group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-xl font-bold text-ink mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
