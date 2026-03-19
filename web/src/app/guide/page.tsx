import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'How to Use Variation Shield — Field Guide',
  description: 'Step-by-step guide for capturing variations on site with Variation Shield.',
};

const steps = [
  {
    number: '01',
    title: 'Log in',
    body: 'Open variationshield.com.au on your phone and tap Log in. Use the email and password your manager sent you. You\'ll land straight on the capture screen.',
    tip: null,
  },
  {
    number: '02',
    title: 'Select your project',
    body: 'At the top of the screen, tap the project name. Pick the job you\'re working on. If you only have one project, it\'ll be pre-selected.',
    tip: null,
  },
  {
    number: '03',
    title: 'Describe the variation',
    body: 'In the big text box, write what extra work was instructed. Be specific — include what was done, where, and why it\'s outside the original scope. One sentence is enough.',
    tip: 'Example: "Site supervisor instructed additional excavation of 2m³ at grid D4 due to unexpected rock — not in original scope."',
  },
  {
    number: '04',
    title: 'Take a photo',
    body: 'Tap "Add photo" and take a photo of the work, the site condition, or the instruction. This is your evidence — it matters.',
    tip: 'A photo of a text message, whiteboard note, or site condition is better than nothing.',
  },
  {
    number: '05',
    title: 'Add more details (optional)',
    body: 'Tap "Add more details" to record who instructed it, the date/time it happened, and your name. The more you fill in, the stronger the claim.',
    tip: null,
  },
  {
    number: '06',
    title: 'Submit',
    body: 'Tap "Submit Variation". That\'s it. The variation is logged with a timestamp and sent to the office dashboard. Your manager will handle the rest.',
    tip: 'You\'ll see a confirmation screen with a reference number. Screenshot it if you want a record.',
  },
];

const faqs = [
  {
    q: 'What if I don\'t have internet on site?',
    a: 'Submit as soon as you get signal. The timestamp records when the work happened, not when you submitted — as long as you fill in the date/time field.',
  },
  {
    q: 'Do I need to install an app?',
    a: 'No. Variation Shield runs in your phone\'s browser. Open variationshield.com.au and log in. You can save it to your home screen for quick access.',
  },
  {
    q: 'What if I make a mistake?',
    a: 'Submit it anyway and let your manager know. They can edit or withdraw it from the dashboard.',
  },
  {
    q: 'Can I see the variations I\'ve submitted?',
    a: 'Yes — tap the home icon at the bottom of the screen to see a read-only list of all variations on your project.',
  },
  {
    q: 'What counts as a variation?',
    a: 'Any work you\'re asked to do that wasn\'t in the original scope. If someone on site tells you to do something extra — even verbally — capture it.',
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#0F1117] text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <a href="https://variationshield.com.au" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <Logo size={28} />
          <span className="font-bold text-[15px] tracking-tight">Variation Shield</span>
        </a>
        <Link href="/login" className="text-sm font-medium text-white/50 hover:text-white transition-colors">
          Log in →
        </Link>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 text-xs font-semibold text-indigo-400 mb-4">
            📱 Field Guide
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            How to capture a variation on site
          </h1>
          <p className="text-white/50 text-base leading-relaxed">
            Takes under 60 seconds. No paperwork, no email chains — just open your phone, describe what happened, and submit.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6 mb-16">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-indigo-400">{step.number}</span>
              </div>
              <div className="pt-1.5 pb-2">
                <h2 className="text-base font-bold mb-1.5">{step.title}</h2>
                <p className="text-white/60 text-sm leading-relaxed mb-2">{step.body}</p>
                {step.tip && (
                  <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2.5 text-xs text-amber-400/80 leading-relaxed">
                    💡 {step.tip}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Save to home screen callout */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 mb-12">
          <h3 className="font-bold text-sm mb-1">📌 Save Variation Shield to your home screen</h3>
          <p className="text-white/50 text-sm leading-relaxed mb-4">One-tap access on site — no typing URLs, no hunting through apps.</p>

          <div className="space-y-5">
            {/* iPhone */}
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">iPhone (Safari)</p>
              <ol className="space-y-1.5 text-sm text-white/60">
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">1.</span><span>Open <span className="text-white/80">Safari</span> and go to <span className="text-white/80">variationshield.com.au</span></span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">2.</span><span>Tap the <span className="text-white/80">Share button</span> at the bottom of the screen (the box with an arrow pointing up)</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">3.</span><span>Scroll down and tap <span className="text-white/80">"Add to Home Screen"</span></span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">4.</span><span>Tap <span className="text-white/80">Add</span> — the icon will appear on your home screen</span></li>
              </ol>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* Android */}
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Android (Chrome)</p>
              <ol className="space-y-1.5 text-sm text-white/60">
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">1.</span><span>Open <span className="text-white/80">Chrome</span> and go to <span className="text-white/80">variationshield.com.au</span></span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">2.</span><span>Tap the <span className="text-white/80">three dots menu</span> (⋮) in the top right corner</span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">3.</span><span>Tap <span className="text-white/80">"Add to Home screen"</span></span></li>
                <li className="flex gap-2"><span className="text-indigo-400 font-bold flex-shrink-0">4.</span><span>Tap <span className="text-white/80">Add</span> — the icon will appear on your home screen</span></li>
              </ol>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="text-lg font-bold mb-5">Common questions</h2>
          <div className="space-y-5">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b border-white/[0.06] pb-5 last:border-0">
                <p className="font-semibold text-sm mb-1.5">{faq.q}</p>
                <p className="text-white/50 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-base transition-colors"
          >
            Log in and capture your first variation
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <p className="mt-4 text-white/30 text-xs">Need help? Email <a href="mailto:shane@variationshield.com.au" className="underline hover:text-white/60">shane@variationshield.com.au</a></p>
        </div>

      </div>
    </div>
  );
}
