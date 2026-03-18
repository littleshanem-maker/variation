import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Variation Shield — Every Variation. Documented. Paid.',
  description: 'Capture scope changes in 60 seconds on site. Send to your client directly from the app. Built for Tier 2/3 Australian subcontractors.',
  openGraph: {
    title: 'Variation Shield — Every Variation. Documented. Paid.',
    description: 'Capture scope changes in 60 seconds on site. Photo evidence, timestamps, professional PDFs. Stop arguing about variations at payment time.',
    url: 'https://variationshield.com.au',
    type: 'website',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F1117] text-white font-sans">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0F1117]/90 backdrop-blur border-b border-white/[0.06]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight">Variation Shield</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <Link href="/calculator" className="hover:text-white transition-colors">ROI Calculator</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-semibold text-white/80 hover:text-white border border-white/20 hover:border-white/40 px-4 py-2 rounded-lg transition-all hidden md:block">Login</Link>
          <Link href="/signup" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-40 pb-24 overflow-hidden">
        {/* background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-8">
            Built for Australian Subcontractors
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
            Every variation.<br />
            <span className="text-indigo-400">Documented. Paid.</span>
          </h1>

          <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed mb-10">
            Capture scope changes in 60 seconds on site — photos, timestamps, cost breakdown, client signature.
            Send professional variation requests directly from the app. Stop losing money at payment time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-indigo-600/25">
              Start Free Trial — No Card Required
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link href="https://leveragedsystems.com.au/schedule" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors">
              Book a 15-min Demo
            </Link>
          </div>

          <p className="mt-5 text-sm text-white/30">
            Setup in 5 minutes · 30-day money-back guarantee · <span className="text-amber-400/70">$299/mo founding member rate (was $499)</span>
          </p>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <div className="border-y border-white/[0.06] bg-white/[0.02] py-5 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-white/40 text-center">
          <span className="flex items-center gap-2"><span className="text-green-400">✓</span> 60-second site capture</span>
          <span className="flex items-center gap-2"><span className="text-green-400">✓</span> Send to client from the app</span>
          <span className="flex items-center gap-2"><span className="text-green-400">✓</span> Professional PDF reports</span>
          <span className="flex items-center gap-2"><span className="text-green-400">✓</span> Works offline on site</span>
          <span className="flex items-center gap-2"><span className="text-green-400">✓</span> Field + office roles</span>
        </div>
      </div>

      {/* THE PROBLEM */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-xs font-bold tracking-widest uppercase mb-3">Sound familiar?</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Three things costing you money right now</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                n: '01',
                title: 'Verbal instructions',
                body: '"Just get it done, we\'ll sort the paperwork later." Three months later, the client has no record of the instruction. Your invoice gets disputed.',
              },
              {
                n: '02',
                title: 'No paper trail',
                body: 'Photos buried in your camera roll. Texts lost in a chain of 800 messages. Nothing referenced, nothing linked, nothing the client can approve against.',
              },
              {
                n: '03',
                title: 'End-of-job negotiations',
                body: 'Every undocumented variation becomes a negotiation when leverage is gone. You did the work. You deserve the money. But you can\'t prove the instruction.',
              },
            ].map((p) => (
              <div key={p.n} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8">
                <div className="text-xs font-bold tracking-widest uppercase text-indigo-400/60 mb-5">{p.n}</div>
                <h3 className="text-lg font-bold mb-3">{p.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/[0.06]" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-xs font-bold tracking-widest uppercase mb-3">The system</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">From site to signed in 60 seconds</h2>
            <p className="text-white/50 mt-4 max-w-lg mx-auto">No complex workflows. No training required. Three steps and the variation is documented before you walk to the next task.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center mb-6">
                <svg width="22" height="22" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-indigo-400/50 mb-3">Step 01</p>
              <h3 className="text-base font-bold mb-3">Capture on site</h3>
              <p className="text-white/45 text-sm leading-relaxed">Open the app. Add photos, description, cost and time impact. Under 60 seconds. Works offline — syncs when back in range.</p>
            </div>
            {/* Step 2 */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center mb-6">
                <svg width="22" height="22" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-indigo-400/50 mb-3">Step 02</p>
              <h3 className="text-base font-bold mb-3">Send to your client</h3>
              <p className="text-white/45 text-sm leading-relaxed">Generate a professional PDF and send it directly from the app. The client approves or rejects via a secure link — no phone calls needed.</p>
            </div>
            {/* Step 3 */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-8 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center mb-6">
                <svg width="22" height="22" fill="none" stroke="#818cf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-indigo-400/50 mb-3">Step 03</p>
              <h3 className="text-base font-bold mb-3">Track to payment</h3>
              <p className="text-white/45 text-sm leading-relaxed">Every variation tracked from draft to approved to paid. Your PM sees everything in real time. No chasing. No arguing at final account.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6" id="features">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-indigo-400 text-xs font-bold tracking-widest uppercase mb-3">Features</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Built for the way subbies actually work</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              { icon: '📸', title: '60-Second Capture', body: 'Photo, description, cost breakdown. Captured on site before you walk to the next task. Time-stamped automatically.' },
              { icon: '📧', title: 'Send to Client', body: 'Professional variation requests sent directly from the app via email. Client approves or rejects with one click — tracked in your dashboard.' },
              { icon: '🖨️', title: 'Print-Ready PDFs', body: 'Variation registers and requests that look like they came from a Tier 1 contractor. The kind the client\'s commercial team processes first.' },
              { icon: '👷', title: 'Field + Office Roles', body: 'Supervisors capture on site — no dollar values visible. PMs see everything in the office dashboard. Right information to the right people.' },
              { icon: '📶', title: 'Works Offline', body: 'No site Wi-Fi? No problem. Capture offline, sync automatically when you\'re back in range. Nothing gets lost.' },
              { icon: '📊', title: 'Real-Time Dashboard', body: 'Every variation across every project — approved, submitted, disputed — at a glance. Know exactly where your money stands.' },
            ].map((f) => (
              <div key={f.title} className="bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-2xl p-7 transition-colors">
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CREDIBILITY */}
      <section className="py-24 px-6 bg-white/[0.02] border-y border-white/[0.06]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-indigo-400 text-xs font-bold tracking-widest uppercase mb-6">Why this exists</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-8">Built from the other side of the desk</h2>
          <div className="space-y-5 text-white/60 text-base leading-relaxed text-left">
            <p>We spent 15 years as project managers on Tier 1 and Tier 2 infrastructure projects across Australia. Our job was processing variation claims from subcontractors — and deciding which ones got paid.</p>
            <p>We saw the same thing every week. Skilled tradespeople doing legitimate extra work. Good claims rejected because the paperwork wasn't there. Not because the work wasn't done — because the evidence wasn't documented properly.</p>
            <p><strong className="text-white">"Everyone on site knew it was extra"</strong> doesn't hold up in a final account meeting. The head contractor's commercial team knows that. And by the time you're arguing about it, the leverage is gone.</p>
            <p>Variation Shield exists because we know exactly what gets approved and what gets thrown in the bin. Every feature is built around the evidence chain a head contractor can't ignore.</p>
          </div>
          <div className="mt-10 pt-8 border-t border-white/[0.08]">
            <div className="font-bold text-lg">Shane Little</div>
            <div className="text-white/40 text-sm mt-1">Founder, Leveraged Systems · 15 years Tier 1 & 2 project management</div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-24 px-6" id="pricing">
        <div className="max-w-lg mx-auto text-center">
          <p className="text-indigo-400 text-xs font-bold tracking-widest uppercase mb-3">Pricing</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple. No surprises.</h2>
          <p className="text-white/50 mb-12">One plan. Everything included. Cancel anytime.</p>

          <div className="bg-white/[0.04] border border-indigo-500/30 rounded-2xl p-8 text-left relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-t-2xl" />
            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-full px-3 py-1 text-xs font-bold text-amber-400 uppercase tracking-wider mb-5">
              ⭐ Founding Member — Limited Spots
            </div>
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-2xl font-medium text-white/30 line-through decoration-red-400">$499</span>
              <span className="text-5xl font-extrabold">$299</span>
              <span className="text-white/40 text-lg">/month</span>
            </div>
            <p className="text-amber-400/80 text-sm font-semibold mb-1">🔒 Price locked for life — never increases</p>
            <p className="text-white/30 text-xs mb-8">30-day money-back guarantee. No lock-in. Cancel anytime.</p>

            <ul className="space-y-3 mb-8">
              {[
                'Full web app + mobile capture',
                'Unlimited variations, projects & team members',
                'Send variations to clients via email',
                'Professional PDF reports',
                'Field supervisor accounts',
                'Priority support from the founder',
                'Variation Agreement Playbook included ($49 value)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                  <span className="text-green-400 font-bold mt-0.5 flex-shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-indigo-600/20">
              Start Free Trial
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <p className="text-center text-white/30 text-xs mt-3">No credit card required to start</p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-white/30">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="14" height="14"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            If you don&apos;t recover more than you spend in 30 days, we refund your first month
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Stop leaving money on the table</h2>
          <p className="text-white/50 text-lg mb-10">Set up in 5 minutes. Capture your first variation today.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-indigo-600/25">
              Start Free Trial — No Card Required
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link href="https://leveragedsystems.com.au/schedule" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors">
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-semibold text-white/50">Variation Shield</span>
            <span className="text-white/20">by</span>
            <a href="https://leveragedsystems.com.au" className="hover:text-white/60 transition-colors">Leveraged Systems</a>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-white/60 transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-white/60 transition-colors">Sign Up</Link>
            <a href="https://leveragedsystems.com.au" className="hover:text-white/60 transition-colors">Leveraged Systems</a>
          </div>
          <div>© 2026 Leveraged Systems. All rights reserved.</div>
        </div>
      </footer>

    </div>
  );
}
