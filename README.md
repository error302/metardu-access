# Metardu Access

> Professional digital fieldbook for engineering, cadastral, topographic surveys and sectional properties. Mobile companion to the Metardu ecosystem.

**Surveyors don't go to the field with laptops — they go with their phones.** Metardu Access is the purpose-built mobile app that puts a professional surveying fieldbook in your pocket, designed for the realities of Kenyan and East African fieldwork: unreliable networks, harsh sunlight, glove use, and statutory compliance with the Survey Act Cap. 299.

## What This Is

Metardu Access is the third pillar of the Metardu ecosystem:

```
                         ┌─────────────────────────────┐
                         │   metardu-access (THIS APP)  │
                         │  Native mobile · field use   │
                         │  React Native + Expo         │
                         └──────────────┬───────────────┘
                                        │ .field-session JSON
                                        │ (SYNC_API_CONTRACT.md)
              ┌─────────────────────────┴─────────────────────────┐
              ▼                                                   ▼
   ┌──────────────────────┐                            ┌──────────────────────┐
   │  metardu (web)       │  ←→  Sync Server  ←→       │  metardu-desktop     │
   │  Next.js + Postgres  │      (ArdhiSasa /           │  Electron + SQLite   │
   │  Multi-user, NLIMS,  │       custom endpoint)      │  Office, deed plans, │
   │  payments, RBAC      │                             │  statutory forms     │
   └──────────────────────┘                             └──────────────────────┘
```

- **Capture** observations, GPS points, and field data on your phone
- **Sync** completed field sessions to the server when back online
- **Export** `.field-session` JSON for USB / email fallback (no conversion needed)
- **Desktop** pulls sessions for traverse adjustment, deed plans, NLIMS submission

## Survey Types Supported

| Type | Status | Description |
|------|--------|-------------|
| **Cadastral** | MVP | Boundary surveys, traverse entry, Bowditch adjustment, parcel definition, beacon library, crypto-sealed sessions |
| **Engineering** | MVP | Leveling, road design, setting out, as-built verification, earthworks volumes |
| **Topographic** | MVP | Feature coding, TIN surface, contours, GNSS RTK via NTRIP, drone GCP management |
| **Sectional Properties** | MVP | Sectional Properties Act 2020 (Kenya) — development, units, floor plans, exclusive use areas |

Plus roadmap support for: Geodetic/Control, Mining, Hydrographic, Drone/UAV Photogrammetry, Deformation/Monitoring.

## Tech Stack

- **Framework**: React Native 0.76 + Expo SDK 52 (with `expo-dev-client` for native access)
- **Language**: TypeScript 5
- **Navigation**: Expo Router v4 (file-based)
- **Styling**: NativeWind v4 (Tailwind for React Native)
- **State**: Zustand + TanStack Query v5
- **Forms**: react-hook-form + zod
- **Local DB**: expo-sqlite (SQLite + SpatiaLite schema ported from metardu-desktop)
- **Maps**: react-native-maps + MapLibre React Native (offline tile cache)
- **Engine**: `@metardu/engine` shared workspace package (traverse, COGO, transforms)
- **i18n**: English + Swahili (Kenya field users)
- **Build/Ship**: Expo EAS Build (cloud) + EAS Update (OTA hotfixes)

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+ (or yarn / pnpm)
- Expo CLI (`npm install -g eas-cli`)
- iOS Simulator (Mac) or Android Studio emulator, or physical device with Expo Go

### Installation

```bash
git clone https://github.com/error302/metardu-access.git
cd metardu-access
npm install
```

### Development

```bash
# Start the dev server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

For development, you can use **Expo Go** on your physical phone — scan the QR code from `npm start`. For native modules (BLE, background location), use a custom dev client (`npm run ios -- --dev-client`).

### Environment

Copy `.env.example` to `.env.local` and fill in:

```bash
EXPO_PUBLIC_SYNC_API_URL=https://metardu.duckdns.org/api/sync
EXPO_PUBLIC_SYNC_AUTH_URL=https://metardu.duckdns.org/api/auth
EXPO_PUBLIC_DEFAULT_COUNTRY_PACK=KEN
EXPO_PUBLIC_DEFAULT_CRS_EPSG=21037
```

### Demo Mode

If no sync server is reachable, the app falls back to **offline demo mode**: any email + password creates a local surveyor profile with a dev API key. Captured data persists in local SQLite and can be exported as `.field-session` JSON files for transfer to the desktop.

## Project Structure

```
metardu-access/
├── app/                          # Expo Router (file-based navigation)
│   ├── (tabs)/                   # Bottom tab screens
│   │   ├── index.tsx             # Home
│   │   ├── projects.tsx          # Projects list
│   │   ├── fieldbook.tsx         # Fieldbook + quick capture
│   │   ├── map.tsx               # Map view
│   │   └── profile.tsx           # Surveyor profile + settings
│   ├── auth/                     # Login, register
│   ├── projects/
│   │   ├── new.tsx               # New project wizard
│   │   └── [id]/index.tsx        # Project detail
│   ├── fieldbook/
│   │   └── observation.tsx       # Total station observation entry
│   ├── sync/queue.tsx            # Sync queue + export
│   ├── settings/                 # Settings + audit log
│   ├── cadastral/                # Cadastral workflow screens
│   ├── engineering/              # Engineering workflow screens
│   ├── topo/                     # Topographic workflow screens
│   └── sectional/                # Sectional properties screens
├── src/
│   ├── components/               # Reusable UI (Button, Card, etc.)
│   ├── lib/
│   │   ├── db/                   # SQLite schema + queries
│   │   ├── sync/                 # Sync engine (SYNC_API_CONTRACT)
│   │   ├── drivers/              # BLE total station / GNSS drivers
│   │   └── crypto/               # RSA sealing
│   ├── stores/                   # Zustand stores (auth, projects, settings)
│   ├── theme/                    # Design system (colors, typography)
│   ├── i18n/                     # English + Swahili
│   └── types/                    # TypeScript domain models
├── packages/
│   └── engine/                   # @metardu/engine (shared with web + desktop)
├── assets/
│   └── images/                   # App icon, splash, logo
├── docs/                         # Architecture, plan, sync, release
├── app.config.ts                 # Expo config
├── eas.json                      # EAS Build profiles
└── package.json
```

## Documentation

- [`docs/PLAN.md`](./docs/PLAN.md) — Full project plan and milestones
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — Architecture decisions and module map
- [`docs/SYNC.md`](./docs/SYNC.md) — How the sync engine implements `SYNC_API_CONTRACT.md`
- [`docs/RELEASE.md`](./docs/RELEASE.md) — Build, signing, store submission runbook

## Country Pack

Metardu Access ships with the **Kenya country pack (KEN)** by default:

- **CRS**: Arc 1960 / UTM zone 37S (EPSG:21037)
- **Datum**: Arc 1960
- **Regulatory body**: Survey of Kenya
- **Statutory documents**: Form No. 4, RDM 1.1, Survey Regulations 1994
- **Submission format**: NLIMS-JSON-1.0 (ArdhiSasa)
- **Languages**: English + Swahili
- **Surveyor identity**: ISK (Institution of Surveyors of Kenya) license number

Additional country packs (Tanzania, Uganda, Rwanda, Burundi, EAC) are planned for v1.1, following the country-pack plugin architecture from metardu-desktop's ADR-005.

## Building & Releasing

### Production build (cloud, via EAS)

```bash
# Configure EAS (first time only)
eas login
eas build:configure

# Build for iOS
npm run build:ios

# Build for Android
npm run build:android

# Build preview (internal testing)
npm run build:preview
```

### OTA updates (no store review needed)

```bash
# Push a hotfix to production
npm run update

# Push to staging
npm run update:staging
```

See [`docs/RELEASE.md`](./docs/RELEASE.md) for the full release runbook including signing, phased rollout, and halt criteria.

## Contributing

This project follows the **NEXUS-Sprint methodology** from [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents). Each feature goes through a Dev↔QA loop with a Reality Checker as the final gate.

1. Pick a workflow stub from `app/cadastral/`, `app/engineering/`, `app/topo/`, or `app/sectional/`
2. Implement the screen using the engine package and existing components
3. Add tests under `tests/`
4. Submit a PR — the Reality Checker agent will review

## License

MIT © error302

## Acknowledgments

- **Metardu ecosystem**: [`error302/metardu`](https://github.com/error302/metardu) (web) and [`error302/metardu-desktop`](https://github.com/error302/metardu-desktop) (desktop)
- **Methodology**: [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents) (NEXUS-Sprint playbook)
- **Regulatory**: Survey of Kenya, Survey Act Cap. 299, Survey Regulations 1994, Sectional Properties Act 2020
