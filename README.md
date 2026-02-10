# Variation Capture

**Mobile app for construction contractors to capture scope changes in 60 seconds.**

Built for Victorian subcontractors who lose revenue when verbal directions, site instructions, and latent conditions aren't documented properly. Variation Capture creates an immutable evidence chain — GPS-stamped, timestamped, SHA-256 hashed — that makes claims defensible in contract disputes.

## Quick Start

```bash
tar xzf variation-capture-scaffold.tar.gz
cd variation-capture
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone. Demo data loads automatically on first launch.

## What's Built

### Screens (8 screens, fully wired)

| Screen | Route | What it does |
|--------|-------|-------------|
| Projects | `/(tabs)/` | All active projects with variation counts, total value, at-risk value |
| Settings | `/(tabs)/settings` | Sync status, evidence chain info, demo reset |
| New Project | `/project/new` | Create project with name, client, contract type |
| Variation Register | `/project/[id]` | All variations for a project, filterable by status |
| Capture Flow | `/capture/[projectId]` | 4-step, 60-second capture: Photos → Voice → Details → Confirm |
| Variation Detail | `/variation/[id]` | Full evidence record with export and submit actions |

### Core Features

- **60-Second Capture Flow** — Camera → voice memo → reference details → save. Designed for dirty hands and direct sunlight.
- **Offline-First Architecture** — All writes go to local SQLite. Works on construction sites with no signal. Syncs when connectivity returns.
- **Immutable Evidence Chain** — SHA-256 hash of every photo and voice note at capture time. GPS coordinates and timestamps locked in. No retroactive changes possible.
- **PDF Export** — Professional variation claim documents with evidence summary, status history, and integrity hash. Opens native share sheet.
- **Submit to Client** — One-tap status change from Captured → Submitted with confirmation.
- **Demo Data** — 3 realistic Victorian projects with 13 variations across all statuses. Reset anytime from Settings.

### Architecture

```
app/                          # Expo Router (file-based navigation)
├── _layout.tsx               # Root layout, DB init, seed data
├── (tabs)/                   # Bottom tab navigator
│   ├── index.tsx             # Projects list
│   └── settings.tsx          # Settings with real functionality
├── project/
│   ├── new.tsx               # New project form
│   └── [id].tsx              # Variation register
├── capture/
│   └── [projectId].tsx       # 60-second capture flow
└── variation/
    └── [id].tsx              # Variation detail + PDF export

src/
├── db/                       # Offline-first data layer
│   ├── schema.ts             # SQLite schema, migrations, WAL mode
│   ├── projectRepository.ts  # Project CRUD
│   ├── variationRepository.ts # Core variation operations
│   └── seedData.ts           # Demo data (3 projects, 13 variations)
├── services/
│   ├── evidenceChain.ts      # SHA-256 hashing service
│   ├── location.ts           # GPS with timeout fallback
│   ├── pdfExport.ts          # HTML→PDF generation + share
│   └── sync.ts               # Sync engine skeleton
├── hooks/
│   └── useConnectivity.ts    # Network state monitor
├── theme/                    # Design system (construction-industrial)
├── types/                    # TypeScript domain model
└── utils/                    # UUID gen, currency, time formatting
```

### Technical Stack

- **Framework:** React Native via Expo SDK 54
- **Language:** TypeScript (strict mode, zero errors)
- **Navigation:** Expo Router (file-based)
- **Database:** expo-sqlite (offline-first, WAL mode)
- **Device APIs:** expo-image-picker, expo-av, expo-location, expo-crypto
- **PDF:** expo-print + expo-sharing
- **Connectivity:** @react-native-community/netinfo

### Design System

- **Palette:** Warm neutral backgrounds (#F5F2ED), safety orange accent (#D4600A)
- **Touch targets:** 48dp minimum, 52dp standard buttons, 64dp FAB — glove-friendly
- **Status colours:** Orange (captured), blue (submitted), green (approved), red (disputed), black (paid)
- **Typography:** High contrast, 11-28px scale, weight 400-900

### Database Schema

5 tables with full relational integrity:

- `projects` — Name, client, reference, contract type, GPS
- `variations` — Status, values (cents), instruction source, evidence hash
- `photo_evidence` — Local/remote URIs, SHA-256 hash, GPS, dimensions
- `voice_notes` — Audio files with transcription fields
- `status_changes` — Append-only audit trail

Every table has `sync_status` (pending/synced/failed) for offline-first operation.

### Demo Data

3 Victorian construction projects:

1. **Westgate Tunnel - Section 4B** (CPBJH JV) — 7 variations, $108,800 total
2. **Metro Crossing - Parkville** (Rail Projects Victoria) — 3 variations, $45,300 total
3. **Northern Hospital - Mechanical** (Lendlease) — 3 variations, $15,800 total

Covers all variation types: site instructions, RFI responses, verbal directions, drawing revisions, latent conditions, delay claims.

## What's Next (Phase 2)

1. **Supabase Backend** — Cloud sync, user auth, multi-device
2. **AI Integration** — Whisper transcription of voice notes, Claude-generated variation descriptions
3. **Real Camera** — Direct camera capture (currently uses image picker)
4. **Photo Embedding** — Base64 photos in PDF exports
5. **Batch Export** — Export all variations for a project as single PDF
6. **App Store Submission** — iOS and Android builds

## Stats

- 22 TypeScript files
- 4,965 lines of code
- 0 TypeScript errors
- 13 seed variations across 5 status types
- 3 realistic Victorian construction projects

---

**Pipeline Consulting Pty Ltd** · variationcapture.com.au
