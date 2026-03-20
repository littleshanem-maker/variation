import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Save Variation Shield to Your Phone — Quick Setup',
  description: 'Add Variation Shield to your phone\'s home screen for one-tap access on site.',
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-[#1a2338] text-white">

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
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 text-xs font-semibold text-indigo-400 mb-4">
            📱 Quick Setup
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Save Variation Shield to your home screen
          </h1>
          <p className="text-white/50 text-base leading-relaxed">
            Takes 30 seconds. Once it's on your home screen, you can open it on site just like any other app — no browser, no typing URLs.
          </p>
        </div>

        {/* iPhone */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-base">🍎</div>
            <h2 className="text-lg font-bold">iPhone</h2>
          </div>
          <ol className="space-y-5">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">1</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Open Safari</p>
                <p className="text-white/50 text-sm leading-relaxed">This only works in Safari — not Chrome or Firefox. Go to <span className="text-white/80">variationshield.com.au/login</span> and make sure the page has fully loaded.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">2</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Tap the Share button</p>
                <p className="text-white/50 text-sm leading-relaxed">Look for the icon at the bottom centre of the screen — it looks like a box with an arrow pointing upward. Tap it.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">3</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Tap "Add to Home Screen"</p>
                <p className="text-white/50 text-sm leading-relaxed">A menu slides up from the bottom. Scroll down through the options until you see <span className="text-white/80">"Add to Home Screen"</span> with a plus icon. Tap it.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">4</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Tap "Add"</p>
                <p className="text-white/50 text-sm leading-relaxed">A confirmation screen appears showing the icon and the name. Tap <span className="text-white/80">Add</span> in the top right. The Variation Shield icon will now appear on your home screen.</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="h-px bg-white/[0.06] mb-8" />

        {/* Android */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-base">🤖</div>
            <h2 className="text-lg font-bold">Android</h2>
          </div>
          <ol className="space-y-5">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">1</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Open Chrome</p>
                <p className="text-white/50 text-sm leading-relaxed">Go to <span className="text-white/80">variationshield.com.au/login</span> and wait for the page to load fully.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">2</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Tap the three-dot menu</p>
                <p className="text-white/50 text-sm leading-relaxed">In the top right corner of Chrome, tap the three vertical dots (⋮). A dropdown menu will appear.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">3</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Tap "Add to Home screen"</p>
                <p className="text-white/50 text-sm leading-relaxed">Find and tap <span className="text-white/80">"Add to Home screen"</span> in the menu. On some Android phones this may appear as <span className="text-white/80">"Install app"</span> — both do the same thing.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 text-lg font-black text-indigo-400 leading-none pt-0.5">4</span>
              <div>
                <p className="text-sm font-semibold mb-0.5">Tap "Add"</p>
                <p className="text-white/50 text-sm leading-relaxed">Confirm by tapping <span className="text-white/80">Add</span> on the prompt that appears. The icon will be added to your home screen immediately.</p>
              </div>
            </li>
          </ol>
        </div>

        {/* CTA */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center">
          <p className="text-white/50 text-sm mb-4">Once it's on your home screen, tap it to log in and you're ready to go.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors"
          >
            Log in to Variation Shield
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <p className="mt-4 text-white/20 text-xs">Questions? <a href="mailto:shane@variationshield.com.au" className="underline hover:text-white/50">shane@variationshield.com.au</a></p>
        </div>

      </div>
    </div>
  );
}
