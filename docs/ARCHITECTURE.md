# Metardu Access — Architecture

## Overview

Metardu Access is a **React Native + Expo** mobile application serving as the field-data-collection layer of the Metardu surveying ecosystem. It is designed for surveyors in Kenya and East Africa who need a professional digital fieldbook that works offline in remote areas, supports statutory compliance, and syncs seamlessly with both the web platform (`metardu`) and the desktop application (`metardu-desktop`).

## Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER  (React Native + NativeWind)                       │
│  - Screens (Expo Router v4 file-based navigation)            │
│  - Reusable components (Button, Card, SurveyTypeBadge, etc.) │
│  - Theme (Metardu brand: orange #F97316, navy #0B1F3A)       │
├─────────────────────────────────────────────────────────────┤
│  STATE LAYER  (Zustand + TanStack Query)                     │
│  - authStore: surveyor profile, API key, login state         │
│  - projectStore: project list, selected project              │
│  - settingsStore: outdoor mode, locale, units, sync prefs    │
├─────────────────────────────────────────────────────────────┤
│  DOMAIN LAYER  (@metardu/engine — shared workspace package)  │
│  - Traverse (Bowditch, Transit, LSA)                         │
│  - COGO (intersections, curves, polygon area)                │
│  - Transforms (WGS84 ↔ UTM, Arc 1960 ↔ WGS84)                │
│  - Pure TypeScript — no platform dependencies                │
├─────────────────────────────────────────────────────────────┤
│  PERSISTENCE LAYER  (expo-sqlite)                            │
│  - SQLite schema v3 (ported from metardu-desktop)            │
│  - 16 tables: projects, points, observations, traverses,     │
│    parcels, beacons, deed_plans, sectional_properties,       │
│    sync_queue, surveyor_profile, field_sessions, audit_log   │
│  - Same shape as .metardu SQLite files (cross-compatible)    │
├─────────────────────────────────────────────────────────────┤
│  NATIVE LAYER  (Expo modules + native libraries)             │
│  - expo-location (foreground + background GPS)               │
│  - expo-camera (geotagged photos)                            │
│  - expo-secure-store (API keys, RSA private keys)            │
│  - expo-file-system (RINEX, GSI, .field-session files)       │
│  - react-native-ble-plx (total stations, GNSS RTK)           │
│  - react-native-maps + MapLibre (offline tile cache)         │
├─────────────────────────────────────────────────────────────┤
│  SYNC LAYER  (custom engine implementing SYNC_API_CONTRACT)  │
│  - Bearer API key auth (stored in secure store)              │
│  - POST /sessions (push field sessions)                      │
│  - GET /sessions (pull from server)                          │
│  - Offline queue (SQLite-backed, retry with backoff)         │
│  - .field-session JSON export (USB / email fallback)         │
└─────────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. React Native + Expo (with `expo-dev-client`)

**Decision**: Use React Native 0.76 with Expo SDK 52 in `expo-dev-client` mode (prebuild), NOT managed workflow, NOT Flutter, NOT native.

**Rationale**:
- Single TypeScript codebase for iOS + Android
- Direct import of `@metardu/engine` from the metardu web codebase (no porting)
- Full native access for BLE, background GPS, secure storage
- Cloud builds via EAS (no local Android SDK / Xcode required)
- OTA updates for hotfixes without store review
- Matches the `agency-agents` Mobile App Builder agent's expertise

**Rejected alternatives**:
- Flutter: would require porting ~15MB of surveying math from TypeScript to Dart
- Native (Swift + Kotlin): 2x development cost for one developer
- Next.js PWA + Capacitor: unreliable BLE, background GPS, and background sync — non-negotiable for professional fieldwork

### 2. SQLite Schema Ported from metardu-desktop

**Decision**: Use the same SQLite schema as `metardu-desktop`'s `.metardu` files.

**Rationale**:
- A field session captured on the phone can be exported as a `.metardu`-compatible SQLite file or as a `.field-session` JSON
- Zero data shape mismatch between mobile and desktop
- The desktop's `database.ts` already defines the schema with migration rules from PostgreSQL (metardu web)
- Three schema versions (v1 walking skeleton, v2 cadastral, v3 sectional + sync queue)

### 3. Shared `@metardu/engine` Workspace Package

**Decision**: Extract surveying math (traverse, COGO, transforms) into a workspace package importable by web, desktop, and mobile.

**Rationale**:
- One source of truth for surveying computations
- Pure TypeScript with no platform dependencies — runs anywhere
- Mobile can do live Bowditch adjustment in the field without server round-trips
- WGS84 ↔ UTM transforms happen client-side for instant GPS-to-grid conversion

### 4. Sync Engine Implements `SYNC_API_CONTRACT.md`

**Decision**: Implement the exact contract documented in `metardu-desktop/docs/SYNC_API_CONTRACT.md`.

**Endpoints**:
- `GET /sessions` — list sessions (filters: surveyorId, projectId, since)
- `GET /sessions/:id` — fetch a single session with points + observations
- `POST /sessions` — push a session from mobile to server

**Auth**: Bearer API key per surveyor, stored in `expo-secure-store` (Keychain on iOS, Keystore on Android).

**Conflict resolution**: UUID-keyed sessions (no conflicts); points within a session are immutable; desktop is source of truth for computed/adjusted data.

**Offline fallback**: Sessions can be exported as `.field-session` JSON files (identical to API response shape) and transferred via USB / email / cloud — no conversion needed on the desktop side.

### 5. File-Based Navigation via Expo Router v4

**Decision**: Use Expo Router v4 with file-based routing (similar to Next.js App Router).

**Rationale**:
- Familiar pattern for developers coming from the metardu web codebase (Next.js)
- Typed routes (`experiments.typedRoutes: true`)
- Native deep linking support
- Tab-based UI with stack navigation for detail screens

### 6. Country Pack Architecture

**Decision**: Externalize country-specific configuration into a country pack (Kenya default).

**Rationale**:
- Matches metardu-desktop's ADR-005 (Country-pack plugin architecture)
- Kenya pack (KEN) ships in v0.1; EAC packs (TZA, UGA, RWA, BDI) planned for v1.1
- Eliminates the 60+ hardcoded `EPSG:21037` references found in metardu web
- Each country pack declares: default CRS, regulatory body, statutory documents, submission format, locale

## Module Map

| Module | Path | Responsibility |
|--------|------|----------------|
| **UI Components** | `src/components/` | Reusable presentational components |
| **Theme** | `src/theme/index.ts` | Colors, typography, spacing tokens |
| **Stores** | `src/stores/` | Zustand state management |
| **Types** | `src/types/index.ts` | Domain models shared with web/desktop |
| **Database** | `src/lib/db/` | SQLite schema + query helpers |
| **Sync** | `src/lib/sync/` | Sync engine + queue + export |
| **Drivers** | `src/lib/drivers/` | BLE total station + GNSS RTK drivers (v0.2) |
| **Crypto** | `src/lib/crypto/` | RSA sealing for statutory compliance (v0.2) |
| **Engine** | `packages/engine/` | Surveying math (shared workspace package) |
| **i18n** | `src/i18n/` | English + Swahili translations |
| **Routes** | `app/` | Expo Router file-based navigation |

## Data Flow

### Capture Flow

```
Surveyor opens app
  ↓
Auth gate → if not authenticated, redirect to /auth/login
  ↓
Tabs visible → Home, Projects, Fieldbook, Map, Profile
  ↓
Surveyor selects project → opens Fieldbook tab
  ↓
Quick capture → GPS point / total station observation / photo
  ↓
Data written to local SQLite (projects, points, observations tables)
  ↓
Audit log entry written
  ↓
If autoSync on + online → push to sync server
  ↓
If offline → queue in sync_queue table
```

### Sync Flow

```
SyncQueueScreen → user taps "Sync Now"
  ↓
SyncEngine.drainQueue() iterates pending items
  ↓
For each item:
  - POST /sessions with Bearer auth
  - On 200: markSynced() → DELETE from sync_queue, UPDATE field_sessions
  - On error: markSyncFailed() → increment attempts, store last_error
  ↓
Surveyor can also "Export .field-session File"
  ↓
SyncEngine.exportSessionToFile() writes JSON to FileSystem.documentDirectory
  ↓
Share sheet opens → user sends via WhatsApp / email / AirDrop / USB
  ↓
Desktop imports the .field-session.json → no conversion needed
```

## Security

- **API keys**: stored in `expo-secure-store` (iOS Keychain / Android Keystore), never in Zustand state or AsyncStorage
- **Surveyor identity**: ISK license number verified server-side; unverified surveyors cannot seal sessions
- **Crypto seals**: RSA-2048 private key generated on-device, public key shared with sync server for verification (v0.2)
- **Audit log**: every point/observation/session action logged with timestamp + user ID; tamper-evident via chain hashing (v0.2)
- **Network**: HTTPS required for all sync traffic; `Authorization: Bearer <api-key>` header
- **No plaintext credentials**: passwords are never stored locally — only the API key returned by the server

## Performance Targets

Following the agency-agents Mobile App Builder targets:

| Metric | Target | How we hit it |
|--------|--------|---------------|
| Cold start | < 3s | Lazy-load screens, minimal splash |
| Memory | < 100MB | React Native 0.76 new architecture, virtualized lists |
| Battery / hr (background GPS) | < 5% | Adaptive accuracy, foreground service only when actively tracking |
| Crash-free sessions | > 99.5% | Sentry monitoring, EAS Update for hotfixes |
| Map render (10k points) | < 1s | MapLibre vector tiles, marker clustering |

## Testing Strategy

- **Unit tests** (`tests/unit/`): `@metardu/engine` math (traverse, COGO, transforms)
- **Integration tests** (`tests/integration/`): database queries, sync engine
- **E2E tests** (`tests/e2e/`): Detox for critical paths (login → create project → capture point → sync)
- **Manual QA**: TestFlight + Play Internal Testing before each release

## Build & Release Pipeline

```
Developer commits to main
  ↓
GitHub Actions runs lint + typecheck + tests
  ↓
EAS Build (cloud) produces iOS .ipa + Android .apk/.aab
  ↓
Internal testing track (TestFlight / Play Internal)
  ↓
Reality Checker agent reviews → PASS or NEEDS WORK
  ↓
Phased rollout: 1% → 5% → 20% → 50% → 100%
  ↓
Halt-on-crash-spike threshold: crash-free < 99.5%, ANR > 0.47%
  ↓
EAS Update for OTA hotfixes (no store review)
```

## Roadmap

### v0.1 (current) — Foundation
- ✅ Project structure, theme, navigation
- ✅ Auth flow with ISK license
- ✅ All 4 survey type screens (Cadastral, Engineering, Topo, Sectional)
- ✅ SQLite schema v3 (matching desktop)
- ✅ Sync engine implementing SYNC_API_CONTRACT
- ✅ Settings, audit log, sync queue UI
- ✅ i18n (English + Swahili)

### v0.2 — Field-Ready MVP
- [ ] Implement cadastral traverse entry + live Bowditch adjustment
- [ ] BLE total station driver (Trimble / Leica / Topcon GSI)
- [ ] GNSS RTK driver (NTRIP client, RINEX recording)
- [ ] Crypto seal (RSA-2048) for sessions
- [ ] Offline map tile cache (MapLibre)
- [ ] Photo capture with geotag
- [ ] Detox E2E tests

### v0.3 — Engineering + Topographic
- [ ] Leveling runs (rise & fall, height of collimation)
- [ ] Road design (curves, super-elevation)
- [ ] Setting out with stakeout
- [ ] TIN surface generation
- [ ] Contour rendering

### v0.4 — Sectional Properties
- [ ] Floor plan drawing tool
- [ ] Sectional plan schedule generation
- [ ] ArdhiSasa JSON export

### v1.0 — Production
- [ ] EAC country packs (TZA, UGA, RWA, BDI)
- [ ] App Store + Play Store public release
- [ ] Full Sentry monitoring
- [ ] 99.5% crash-free sessions

### v1.1+
- [ ] Drone / UAV photogrammetry pipeline
- [ ] Deformation monitoring
- [ ] Mining surveys
- [ ] Hydrographic surveys
