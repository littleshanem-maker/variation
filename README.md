# Variation Capture v2.0

**Mobile app for construction contractors to capture scope changes in 60 seconds.**

Built for Victorian subcontractors who lose revenue when verbal directions, site instructions, and latent conditions aren't documented properly. Variation Capture creates an immutable evidence chain — GPS-stamped, timestamped, SHA-256 hashed — that makes claims defensible in contract disputes.

## Quick Start

```bash
cd variation
npm install --legacy-peer-deps
npx expo start
```

Scan the QR code with Expo Go on your phone. Demo data loads automatically on first launch.

## What's New in v2.0 (Phase 2)

### Supabase Cloud Sync
- Full bidirectional sync between local SQLite and Supabase
- Row Level Security — each user only sees their own data
- Auto-sync when connectivity returns after offline work
- Storage bucket for evidence file uploads (photos, voice)
- Migration SQL ready to run in Supabase SQL Editor

### AI Integration
- **Whisper Transcription** — Voice notes are automatically transcribed to text via OpenAI Whisper API
- **Claude AI Descriptions** — Generate professional, contract-ready variation descriptions from voice transcription + site context
- Both services degrade gracefully — app works fully without API keys

### Direct Camera Capture
- Camera launches directly for evidence photography
- Image picker still available for existing photos from library
- Multiple photo support with individual hash verification

### Photo Embedding in PDFs
- Base64-encoded photos embedded directly in exported PDFs
- No external dependencies — PDFs are self-contained evidence packages

### Batch Export
- Export all variations for a project as a single PDF
- Cover page with project summary, total value, at-risk value
- Page-break between each variation for professional formatting

### EAS Build Configuration
- Development, preview, and production build profiles
- Android APK and app-bundle support
- iOS simulator and device build support
- Ready for App Store / Play Store submission

## Screens (8 screens, fully wired)

| Screen | Route | What it does |
|--------|-------|-------------|
| Projects | `/(tabs)/` | All active projects with variation counts, total value, at-risk value |
| Settings | `/(tabs)/settings` | Sync status, AI service status, evidence chain info, demo reset |
| New Project | `/project/new` | Create project with name, client, contract type, auto GPS |
| Variation Register | `/project/[id]` | All variations for a project, filterable by status, batch export, delete project |
| Capture Flow | `/capture/[projectId]` | 4-step, 60-second capture: Photos → Voice → Details → Confirm |
| Variation Detail | `/variation/[id]` | Full evidence record with status lifecycle, voice playback, AI descriptions, edit, delete |

## Core Features

- **60-Second Capture Flow** — Camera → voice memo → reference details → save. Designed for dirty hands and direct sunlight.
- **Full Status Lifecycle** — Captured → Submitted → Approved → Paid, with Disputed at any stage. Append-only audit trail.
- **Offline-First Architecture** — All writes go to local SQLite. Works on construction sites with no signal.
- **Cloud Sync (Phase 2)** — Supabase backend with RLS. Auto-syncs when connectivity returns.
- **AI Transcription (Phase 2)** — Voice notes auto-transcribed via OpenAI Whisper.
- **AI Descriptions (Phase 2)** — Claude generates formal variation descriptions from voice + context.
- **Immutable Evidence Chain** — SHA-256 hash of every photo and voice note. Combined evidence hash per variation.
- **PDF Export with Photos (Phase 2)** — Base64-embedded photos in self-contained PDF evidence packages.
- **Batch Export (Phase 2)** — All project variations in one PDF with cover page.
- **Voice Playback** — Play back recorded voice notes in variation detail.
- **Full-Screen Photo Viewer** — Tap any photo to view full-screen.
- **Edit & Delete** — Update values, descriptions, notes. Delete variations or entire projects.
- **Demo Data** — 3 realistic Victorian projects with 13 variations. Reset anytime.

## Architecture

```
app/                          # Expo Router (file-based navigation)
├── _layout.tsx               # Root layout, DB init, seed data
├── (tabs)/                   # Bottom tab navigator
│   ├── index.tsx             # Projects list with pull-to-refresh
│   └── settings.tsx          # Settings: sync, AI, evidence chain
├── project/
│   ├── new.tsx               # New project form
│   └── [id].tsx              # Variation register with batch export
├── capture/
│   └── [projectId].tsx       # 60-second capture with camera + voice
└── variation/
    └── [id].tsx              # Detail: status lifecycle, AI, export

src/
├── config/                   # Central configuration
│   └── index.ts              # Supabase, OpenAI, Anthropic, app settings
├── db/                       # Offline-first data layer
│   ├── schema.ts             # SQLite schema, WAL mode
│   ├── projectRepository.ts  # Project CRUD + delete
│   ├── variationRepository.ts # Full variation CRUD, status, evidence
│   └── seedData.ts           # Demo data (3 projects, 13 variations)
├── services/
│   ├── ai.ts                 # Whisper transcription + Claude descriptions (Phase 2)
│   ├── auth.ts               # Supabase authentication (Phase 2)
│   ├── evidenceChain.ts      # SHA-256 hashing + combined hash
│   ├── location.ts           # GPS with timeout fallback
│   ├── pdfExport.ts          # PDF with embedded photos + batch (Phase 2)
│   └── sync.ts               # Bidirectional cloud sync (Phase 2)
├── hooks/
│   └── useConnectivity.ts    # Network state monitor (fixed boolean)
├── theme/                    # Design system (construction-industrial)
├── types/                    # TypeScript domain model
└── utils/                    # UUID gen, currency, time formatting

supabase/
└── migration.sql             # Full Supabase schema with RLS policies
```

## Enabling Cloud Features

The app works fully offline without any configuration. To enable cloud features:

### Supabase (Cloud Sync + Auth)
1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/migration.sql` in the SQL Editor
3. Add to `app.json` → `expo.extra`:
   ```json
   "supabaseUrl": "https://your-project.supabase.co",
   "supabaseAnonKey": "your-anon-key"
   ```

### OpenAI (Voice Transcription)
1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Add to `app.json` → `expo.extra`:
   ```json
   "openaiApiKey": "sk-..."
   ```

### Anthropic (AI Descriptions)
1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Add to `app.json` → `expo.extra`:
   ```json
   "anthropicApiKey": "sk-ant-..."
   ```

## Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Android APK (for direct install)
eas build --profile preview --platform android

# Android App Bundle (for Play Store)
eas build --profile production --platform android

# iOS (requires Apple Developer account)
eas build --profile production --platform ios
```

## Technical Stack

- **Framework:** React Native via Expo SDK 54
- **Language:** TypeScript (strict mode)
- **Navigation:** Expo Router (file-based)
- **Database:** expo-sqlite (offline-first, WAL mode)
- **Cloud:** Supabase (auth, Postgres, storage, RLS)
- **AI:** OpenAI Whisper (transcription), Anthropic Claude (descriptions)
- **Device APIs:** expo-camera, expo-image-picker, expo-av, expo-location, expo-crypto
- **PDF:** expo-print + expo-sharing
- **Connectivity:** @react-native-community/netinfo

## Design System

- **Palette:** Warm neutral backgrounds (#F5F2ED), safety orange accent (#D4600A)
- **Touch targets:** 48dp minimum, 52dp standard buttons, 64dp FAB — glove-friendly
- **Status colours:** Orange (captured), blue (submitted), green (approved), red (disputed), black (paid)
- **Typography:** High contrast, 11-28px scale, weight 400-900

## Database Schema

5 tables with full relational integrity + foreign key cascading deletes:

- `projects` — Name, client, reference, contract type, GPS
- `variations` — Status, values (cents), instruction source, evidence hash, AI fields
- `photo_evidence` — Local/remote URIs, SHA-256 hash, GPS, dimensions
- `voice_notes` — Audio files with transcription fields and status tracking
- `status_changes` — Append-only audit trail

Every table has `sync_status` (pending/synced/failed) for offline-first operation.

## Demo Data

3 Victorian construction projects:

1. **Westgate Tunnel - Section 4B** (CPBJH JV) — 7 variations, $108,800 total
2. **Metro Crossing - Parkville** (Rail Projects Victoria) — 3 variations, $45,300 total
3. **Northern Hospital - Mechanical** (Lendlease) — 3 variations, $15,800 total

## Bug Fix: Boolean Type Error

The `useConnectivity` hook now uses strict boolean coercion (`state.isConnected === true`) instead of nullish coalescing (`state.isConnected ?? true`). This prevents the React Native render error `TypeError: expected dynamic type 'boolean', but had type 'string'` that occurred when NetInfo returned `null` for `isConnected` during initial state.

## Stats

- 26 TypeScript files
- ~6,200 lines of code
- 0 TypeScript errors
- 13 seed variations across 5 status types
- 3 realistic Victorian construction projects

---

**Pipeline Consulting Pty Ltd** · variationcapture.com.au
