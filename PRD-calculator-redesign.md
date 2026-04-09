# PRD: Calculator Page Redesign
**File:** `web/public/calculator.html`
**URL:** variationshield.com.au/calculator
**Goal:** Increase conversion from calculator visitor → free tier signup
**Status:** Ready for development

---

## Context

The calculator page is the highest-intent page on the site. A visitor who enters their numbers and sees they're losing $300K/year is pre-sold on the problem. The page currently treats the output as informational. These changes make it a conversion event.

Ship P1 items as a single batch first. P2 items follow in a second pass. P3 only after P1+P2 are solid.

---

## P1 Changes — Must Ship

### Change 1: Progressive Disclosure with Calculate Button

**Current:** Output panel updates in real time as sliders move. Both panels always visible, equal weight.

**Target:**
- Output panel starts blurred (`filter: blur(8px)`) with a skeleton/placeholder state. Overlay text: *"Plug in your numbers to see the real cost."* (centred, glass-morphism overlay effect)
- After user adjusts at least one slider, a prominent CTA button appears below the sliders: **"See My Leakage Report"** or **"Calculate My Loss"**
- Clicking triggers a 300–500ms reveal: output panel un-blurs, numbers animate in (see Change 4)
- **One-time gate only.** After first reveal, sliders recalculate in real time. The blur/button only applies to the first interaction.

**Implementation notes:**
- Use `filter: blur(8px)` + `opacity` transition on the output panel
- Show placeholder shapes (skeleton cards) in blurred state so user knows output is there
- Track first interaction with a simple boolean flag (`hasRevealed`)

---

### Change 2: Contextual CTA Below ROI Result

**Current:** ROI figure shown but no CTA in viewport. User must scroll to find a signup path.

**Target:** Immediately below the ROI row, add a full-width CTA block:

- **Primary button:** "Start recovering your variations — free" → links to `/signup/free`
- **Secondary text link:** "Or download your full Leakage Report as PDF" (hooks into Change 7 when built — for now, omit or link to `/signup/free` as fallback)
- CTA fades in as part of the reveal animation (Change 1), slightly after the numbers land
- Use the site's primary action colour (indigo/purple `#4f46e5`)
- **Mobile:** CTA must be visible without scrolling after results display. Auto-scroll to CTA after reveal if needed.

---

### Change 3: Reweight Output Card Visual Hierarchy

**Current:** All four output cards (Variation Throughput, Current Annual Loss, Recoverable, Cost of VS) have identical visual weight.

**Target — make the cards tell a story:**

1. **Headline "You're losing $X/year"** — increase font size. This is the emotional hook.
2. **"Lost Every Year" card** — red/danger treatment (`#ef4444` background tint or strong red border/accent). This is the gut punch.
3. **"You Could Get Back" card** — green/positive treatment (`#22c55e`). This is the hope.
4. **"Cost of Variation Shield" card** — visually subdued. Smaller font, muted border. Cost should feel trivial.
5. **ROI row** — visual climax. Subtle green glow, highlighted border, or background treatment. The "58.5×" number should feel like a punchline that lands.

**Design arc:** gut punch (red) → hope (green) → no-brainer (ROI climax).

---

## P2 Changes — Should Ship

### Change 4: Animated Number Count-Up on Reveal

**Target:**
- On Calculate button click, all dynamic dollar values animate from $0 → final value over 800–1200ms
- Easing: `ease-out` or `cubic-bezier(0.22, 1, 0.36, 1)` — starts fast, decelerates to land with weight
- ROI multiplier (`58.5×`) counts up last, landing ~200ms after dollar figures settle
- Static values (`$299/mo` cost, percentage labels) appear without animation
- Format numbers with commas during animation (e.g. `$214,583` not `$214583`)
- Respect `prefers-reduced-motion` — skip animation, show final values immediately

**Implementation:** Use `requestAnimationFrame` natively (no library needed).

---

### Change 5: Time Horizon Toggle (1yr / 3yr / 5yr)

**Target:**
- Add a segmented pill toggle above the output panel: `1 Year | 3 Years | 5 Years`
- Default: 1 Year (current behaviour)
- Selecting 3yr or 5yr multiplies loss, recovery, and cost figures (simple multiplier — no discount rate)
- Headline updates: "You're losing $1,500,000 over 5 years to variation disputes."
- Switching horizon re-triggers the count-up animation (Change 4)
- ROI ratio stays constant (both sides scale linearly) — don't display it changing

---

### Change 6: Social Proof and Benchmark Line

**Target:** Add a contextual line below output cards or above ROI row:

> *"Australian subcontractors with proper variation documentation recover 30–70% of disputed claims. Most recover less than 10% without a system."*

Source: KPMG/AIQS benchmarks + SOPA adjudication data (already cited in the inputs footnote).

Optionally add a stat row: *"Used by X subcontractors"* or *"Over $X in variations tracked."* Use real numbers only — check with Shane before publishing placeholder stats.

---

## P3 Changes — Nice to Have (after P1+P2 solid)

### Change 7: Email-Gated PDF Leakage Report

- Secondary CTA below the primary signup button: "Download your Variation Leakage Report as PDF"
- Clicking opens a minimal modal: email (required), company name (optional)
- On submit: generate branded PDF (inputs + outputs + ROI + VS pitch), email it via `/api/calculator-lead` and offer immediate download
- Add to nurture sequence if email automation is wired up
- PDF: Variation Shield logo, colours, footer with variationshield.com.au

### Change 8: Visual Polish

- Slider handles: subtle pulse/glow on hover
- Card reveal: stagger appearance by 100–150ms each (cascade in, not all at once)
- Mobile: auto-scroll to results after Calculate button clicked
- Particle/glow effect behind headline loss number on reveal (subtle)
- WCAG AA contrast check on all text vs dark background

---

## Acceptance Criteria

- [ ] Output panel starts blurred/gated behind a Calculate button
- [ ] Clicking Calculate triggers reveal animation with number count-up
- [ ] "Start recovering your variations — free" CTA visible in viewport immediately after results display
- [ ] "Lost Every Year" card uses red treatment
- [ ] "You Could Get Back" card uses green treatment
- [ ] "Cost of VS" card is visually subdued
- [ ] ROI row has highlighted/climax treatment
- [ ] Time horizon toggle (1yr / 3yr / 5yr) updates all calculated figures
- [ ] At least one social proof / benchmark line visible in output area
- [ ] All animations respect `prefers-reduced-motion`
- [ ] Mobile: results auto-scroll into view after Calculate; CTA visible without additional scrolling
- [ ] WCAG AA contrast met on all text against dark background

---

## Deploy

```bash
cd ~/dev/variation
git add -A
git commit -m "Calculator redesign: progressive disclosure, visual hierarchy, CTA, time toggle"
# post-commit hook auto-pushes → Vercel → variationshield.com.au
```

**Do NOT run `vercel --prod` from this directory.**

---

When completely finished, run:
```
openclaw system event --text "Done: Calculator redesign — P1+P2 changes live at variationshield.com.au/calculator" --mode now
```
