# PRD: Voice-to-Variation — April 2026 Experiment

**Built:** 2026-03-26 (Henry 🦡 overnight build)
**Owner:** Linus  
**Status:** Ready to build — April experiment starts week of 31 Mar
**Target:** Ship the core experiment (voice → structured capture) by end of first week of April
**Scope:** Mobile-first. Add a mic button to the /capture flow. User speaks, app transcribes + parses → fields pre-filled → user reviews → submits.

---

## Why This

Shane's core product promise: "Capture a variation in 60 seconds on-site."

The friction in that 60 seconds is typing on a phone at a construction site:
- Dirty hands, gloves, loud environment
- Description field requires composing sentences under pressure
- Typos → looks unprofessional if sent to client directly

The hypothesis: **speaking is faster than typing on-site.** A 10-second voice memo → 30 seconds of review → submit. Total time drops from 60 seconds to under 45 seconds. More importantly, the *quality* of the description improves — people speak in complete sentences when describing events.

This is also the wrapper test Shane described on 25 Mar: "Can I build a wrapper that means I never have to be in the room?"

Voice-to-variation answers that for the field layer. The user doesn't need to know how to write a formal variation description — they just need to tell the phone what happened.

---

## Constraints

- **Mobile first.** The /capture page is the entry point. This is where supers and leading hands work.
- **No AI at capture is current state.** VS today is column 1 SaaS (pure SaaS, no runtime AI for users). This experiment deliberately breaks that rule. Keep it behind a feature flag or a clearly marked "experimental" state until validated.
- **Anthropic API key must be in Vercel env** for server-side processing. Check before building — key must exist in variation project production env vars.
- **Fallback required.** If voice capture fails (mic permission denied, transcription error, API timeout) → fall back to manual text entry silently. Never show a broken state to a field user.
- **Data privacy.** Audio is transcribed server-side. Transcript is processed by LLM. Neither the audio nor the raw transcript is stored — only the structured output.

---

## User Story

**Persona:** Mark, site supervisor. Industrial maintenance job. Head contractor issues a verbal direction at 7am.

> "Hey Mark — while you're here, can you also clean up that spill containment berm near the access road? It's not in scope but we need it done today."

Mark has dirty gloves and 3 minutes before the next task. He does this:

1. Opens Variation Shield on phone (app.variationshield.com.au)
2. Taps the FAB (Quick Notice) or navigates to /capture
3. Sees a mic button next to the description field
4. Holds the mic button and speaks:
   > "Direction from Tom Chen, superintendent. Desilting and clean-up of the spill containment berm near the western access road. Verbal direction issued at 7am, 26 March. Not in original scope."
5. Releases. Transcription runs (1–2 seconds).
6. Fields populate:
   - Description: "Direction from Tom Chen (Superintendent) to desilting and clean-up of the spill containment berm near the western access road. Verbal direction issued at 7:00am, 26 March 2026. Scope: out-of-scope work."
   - Instruction source: "Verbal direction" (auto-detected)
   - Issued by: "Tom Chen" (auto-detected)
7. Mark reviews, adjusts if needed, hits Submit.

Total time: under 45 seconds. Description quality: better than he'd have typed.

---

## Technical Architecture

### Frontend — /capture (mobile)

**New element:** Voice capture button (mic icon)

**Location:** Inline with the Description field — small mic icon button to the right of the field label or as an overlay FAB variant.

**UI states:**
- `idle` — mic icon, grey
- `recording` — mic icon, red pulse animation, "Recording..." label
- `processing` — spinner, "Transcribing..."
- `ready` — green tick, fields populated, user can edit
- `error` — brief toast: "Voice capture failed — type your description instead"

**Behaviour:**
1. User taps mic → browser requests microphone permission (if not already granted)
2. If denied → show toast: "Mic access needed. Type your description instead."
3. If granted → start recording via `MediaRecorder` API (webm/opus)
4. While recording → show red pulse, duration counter (max 30 seconds)
5. User releases → audio blob sent to `/api/voice-capture` as `multipart/form-data`
6. Response: `{ description, instruction_source, issued_by, raw_transcript }` (JSON)
7. Populate form fields from response. Show green tick state.
8. If API call fails → show error toast, revert to empty description field

**Browser support:**
- Safari iOS 14.3+ supports `MediaRecorder` — check compatibility
- Fallback: if `MediaRecorder` not available, hide mic button entirely (don't show broken UI)

**Max recording length:** 30 seconds with automatic stop. Most field descriptions will be under 10 seconds.

---

### API — /api/voice-capture

**New endpoint.** Server-side only. POST.

**Input:** `multipart/form-data` with `audio` field (Blob, webm/opus)

**Step 1 — Transcription**

Use the Anthropic API (or Whisper via OpenAI) to transcribe the audio.

Option A (Anthropic): Upload audio as a file attachment to the Messages API using the `audio` content block (if supported in Claude 3.5+). 

Option B (OpenAI Whisper): POST to `https://api.openai.com/v1/audio/transcriptions` with the audio file.

**Recommendation:** Use Whisper API for transcription (fast, cheap, purpose-built for speech). Then use Claude (already integrated via /api/ai-proxy) for parsing. Two separate calls.

**Whisper call:**
```
POST https://api.openai.com/v1/audio/transcriptions
Authorization: Bearer $OPENAI_API_KEY
model: whisper-1
file: [audio blob]
language: "en"
```

**Alternatively:** If we want to avoid a second API key, use the Anthropic transcription path if it exists. Check whether Claude 3.5 Haiku can transcribe audio directly. If yes, single API call.

**Step 2 — Parsing with Claude**

Input: raw transcript string.

Prompt (system):
```
You are a construction variation parser. Extract structured data from a site supervisor's spoken description of a variation or direction.

Output JSON only. No commentary.

Schema:
{
  "description": "formal description of the work directed, suitable for a legal variation document (1-3 sentences, third person, past tense where appropriate)",
  "instruction_source": "verbal_direction" | "written_instruction" | "site_instruction" | "email_instruction" | "other",
  "issued_by": "name and/or role of the person who issued the direction (or null if not mentioned)"
}

Rules:
- description: rephrase casually spoken words into formal documentation language. Preserve all factual content. Do not invent details.
- instruction_source: infer from context ("Tom said", "written notice", "email from", etc.). Default to "verbal_direction" if unclear.
- issued_by: extract name/role if clearly stated. Include title if given (e.g. "Tom Chen, Superintendent").
- Never add cost estimates, dollar values, or quantities unless explicitly stated.
```

User message: `[raw transcript]`

**Response handling:**
- Parse JSON from Claude response
- Return to frontend: `{ description, instruction_source, issued_by, raw_transcript }`
- Do NOT store audio, raw transcript, or structured output in database — ephemeral, in-flight only
- On any error (transcription failure, Claude timeout, JSON parse failure): return 500 with `{ error: "voice_capture_failed" }`

---

### Environment Variables (add to Vercel variation project production)

If using OpenAI Whisper:
- `OPENAI_API_KEY` — OpenAI API key

If using Claude for transcription (single-call):
- `ANTHROPIC_API_KEY` — already should be in env (check)

---

## Acceptance Criteria

- [ ] Mic button visible on /capture (Description field area) on mobile
- [ ] Mic button hidden on desktop (not a desktop UX, don't clutter the form)
- [ ] Tap → record → release → transcribe → fields populated in under 3 seconds (network dependent, accept up to 5s)
- [ ] `instruction_source` field pre-populated from transcript where detectable
- [ ] `issued_by` field pre-populated from transcript where detectable
- [ ] If mic permission denied: graceful fallback, no broken UI
- [ ] If API fails: graceful fallback, description field remains empty and editable
- [ ] Audio not stored anywhere (confirm in /api/voice-capture)
- [ ] Works on Safari iOS 14.3+ and Chrome for Android
- [ ] Feature flag available to disable without a deploy (env var: `VOICE_CAPTURE_ENABLED=true`)

---

## Out of Scope (this iteration)

- Voice for any field other than description / instruction_source / issued_by
- Desktop mic support
- Auto-submit after voice (user always reviews before submitting)
- AI-generated cost estimates from voice
- Multi-language support
- Offline/PWA voice capture (network required for transcription)

---

## Test Scenarios

Run these on an iOS device before marking complete:

1. **Clean capture:** Say a full direction clearly → fields populate correctly
2. **Noisy capture:** Background noise, typical site conditions → description still coherent
3. **Name detection:** Include "direction from [Name], superintendent" → issued_by populated
4. **Written instruction mention:** Include "got an email from the super" → instruction_source = email_instruction
5. **Denied mic permission:** Tap mic, deny → toast, no crash
6. **API timeout:** Kill the API mid-request → toast, fallback to manual
7. **Long silence:** Hit record, say nothing for 5+ seconds → handle gracefully

---

## Timeline

| Milestone | Target |
|---|---|
| Env var check (OpenAI or Anthropic key available) | Day 1 (31 Mar) |
| `/api/voice-capture` endpoint built + tested with cURL | Day 2 |
| Frontend mic button + recording UI | Day 2–3 |
| End-to-end test on iOS Safari | Day 3–4 |
| Feature flag on, ship to production | Day 5 (4 Apr) |
| Real-world test with Shane on-site or simulated | Week 2 (6–10 Apr) |
| Review + decision: extend to Variation Request form? | Week 3 |

---

## Success Metric

After shipping: Shane tests with at least one field capture session and confirms:
1. Voice description quality is ≥ manually typed description
2. Total capture time under 45 seconds (voice → review → submit)
3. No field confusion (incorrect instruction_source or issued_by misparse)

If the metric is met → ship to Vecta + GEM Fire as "experimental feature, let us know how it goes."

---

## Notes for Linus

- The `/api/ai-proxy` endpoint already exists (commit 98419dbb) — you can extend it or build `/api/voice-capture` as a separate route
- The ANTHROPIC_API_KEY needs to be confirmed in Vercel env vars (it's missing as of 2026-03-14, but check — it may have been added since)
- If Anthropic can't do audio transcription natively (verify for the current API version), Whisper is the clean answer. OpenAI account access — check `env | grep -i openai` or `~/.config/openai/` first
- The `MediaRecorder` API in Safari requires the user to have interacted with the page — the tap on the mic button counts, so you'll have a user gesture
- For the Claude parsing prompt: keep it tight. The prompt above is the spec. Don't over-engineer the schema — three fields is enough for this experiment
- Hold the audio in memory (ArrayBuffer/Blob) only — don't write it to disk or database at any point

---

*Henry 🦡 — PRD v1.0, 26 Mar 2026*
