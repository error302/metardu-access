# Metardu Access — Project Plan

This document tracks the execution plan for building Metardu Access end-to-end. It follows the **NEXUS-Sprint methodology** from `msitarzewski/agency-agents` — a 7-phase pipeline with Dev↔QA loops and Reality Checker as the final gate.

## Phase 0 — Discovery ✅

**Agents**: Trend Researcher, GIS Technical Consultant, Codebase Onboarding Engineer

**Completed**:
- Researched `error302/metardu` (web) — Next.js 14, 200+ routes, PostgreSQL 106 tables, NextAuth + RBAC, M-Pesa, NLIMS/ArdhiSasa
- Researched `error302/metardu-desktop` — Electron + SQLite, sync-service.ts, full cadastral models, statutory forms
- Researched `msitarzewski/agency-agents` — NEXUS-Sprint mode, Mobile App Builder + Release Engineer agents, 7-phase playbook
- Read `SYNC_API_CONTRACT.md` — `.field-session` JSON format, Bearer API key auth, UUID sessions, immutable points
- Analyzed Metardu logo via VLM — orange #F97316, navy #0B1F3A, white, surveying instrument + "M" mark

**Key decisions**:
- Tech stack: React Native 0.76 + Expo SDK 52 + expo-dev-client
- Database: expo-sqlite (SQLite schema ported from metardu-desktop)
- Engine: `@metardu/engine` shared workspace package
- Country pack: KEN (EPSG:21037, English + Swahili) for MVP

## Phase 1 — Strategy ✅

**Agents**: Senior PM, UX Architect, Software Architect, Backend Architect, GIS Technical Consultant, Brand Guardian

**Completed**:
- MoSCoW scope: MVP = cadastral + engineering + topo + sectional; v1.1 = EAC country packs; v1.2 = drone
- UX architecture: 5-tab bottom navigation (Home, Projects, Fieldbook, Map, Profile)
- Module map: app/ (routes), src/ (lib + components + stores), packages/engine/
- Brand identity applied: orange/white/navy theme, logo-derived app icons, splash, and wordmark
- Sync strategy: implement SYNC_API_CONTRACT.md verbatim; offline queue in SQLite; .field-session JSON export as USB fallback

## Phase 2 — Foundation ✅

**Agents**: DevOps Automator, Frontend Developer, Backend Architect, Identity Access Engineer

**Completed**:
- Expo project initialized (SDK 52, TypeScript 5, NativeWind v4)
- Metro + Babel configured for workspace packages
- Tailwind theme with Metardu brand colors
- App icons + splash assets generated from source logo (Python script in `/scripts/generate_metardu_assets.py`)
- SQLite schema v3 (16 tables, ported from metardu-desktop)
- Sync engine (`src/lib/sync/engine.ts`) implementing SYNC_API_CONTRACT
- Auth store with offline demo mode fallback
- Project + settings Zustand stores
- i18n (English + Swahili)
- `@metardu/engine` package with traverse, COGO, transforms

## Phase 3 — Build ✅

**Agents**: Mobile App Builder, Frontend Developer, Backend Architect, Identity Access Engineer

**Completed (Dev↔QA loops)**:
- Auth screens (login, register with ISK validation)
- Home dashboard (stats, quick actions, recent projects)
- Projects list + new project wizard (2-step: type + details)
- Project detail (Overview, Points, Workflow tabs)
- Fieldbook tab with GPS quick-capture (WGS84 → Arc 1960/UTM 37S transform via engine)
- Observation entry form (total station: HA, VA, SD, face, instrument heights, met corrections)
- Map view (react-native-maps with UTM → WGS84 conversion for display)
- Profile + Settings (outdoor mode, high contrast, language toggle, units, API key)
- Sync queue screen with drain + .field-session export
- Audit log screen (tamper-evident regulatory log)
- All 4 survey-type workflow screens:
  - Cadastral: traverse, adjustment, parcels, beacons, seal
  - Engineering: leveling, road, setting-out, as-built, earthworks
  - Topographic: features, TIN, contours, drone
  - Sectional: development, units, floorplans, EUAs

## Phase 4 — Hardening (in progress)

**Agents**: Code Reviewer, Test Automation Engineer, Performance Benchmarker, Accessibility Auditor, Reality Checker

**Status**:
- ✅ TypeScript strict mode enabled
- ✅ ESLint configured
- [ ] Unit tests for `@metardu/engine` (vitest)
- [ ] Integration tests for SQLite queries
- [ ] E2E tests via Detox for critical paths
- [ ] Accessibility audit (Section 508 / WCAG, outdoor visibility, glove-friendly touch targets)
- [ ] Performance benchmarks (cold start <3s, memory <100MB, battery <5%/hr)
- [ ] Reality Checker final gate

## Phase 5 — Launch (pending v0.2)

**Agents**: Mobile Release Engineer, App Store Optimizer, Technical Writer

**Pending**:
- [ ] EAS Build profiles (production, preview, development)
- [ ] iOS signing identity via EAS (App Store Connect)
- [ ] Android Play App Signing
- [ ] TestFlight internal testing
- [ ] Play Internal Testing track
- [ ] Store listings (English + Swahili) with screenshots
- [ ] Phased rollout plan (1% → 5% → 20% → 50% → 100%)
- [ ] Halt-on-crash-spike thresholds (crash-free <99.5%, ANR >0.47%)
- [ ] User guide for surveyors

## Phase 6 — Operate (post-launch)

**Agents**: Analytics Reporter, Infrastructure Maintainer, Support Responder

**Ongoing**:
- Sentry crash monitoring
- EAS Update for OTA hotfixes
- User feedback loop → next sprint
- Quarterly security review (API key rotation, audit log integrity)

## Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| MVP scope complete | 4 survey types with fieldbook + sync | ✅ |
| Code coverage | > 70% on engine + sync | pending |
| Cold start | < 3s | needs measurement |
| Crash-free sessions | > 99.5% | needs measurement |
| Time to first point capture | < 30s from app launch | needs measurement |
| Sync success rate | > 99% when online | needs measurement |
| Reality Checker PASS | final gate before launch | pending |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sync server not deployed yet | High | Blocks real sync | Demo mode + .field-session export fallback already implemented |
| BLE driver complexity | High | Blocks total station integration | v0.2 milestone; manual entry works in v0.1 |
| App Store / Play Store review delays | Medium | Blocks public launch | Use TestFlight + Play Internal first; phased rollout |
| Arc 1960 transform accuracy | Low | Survey errors | Use EPSG-published Helmert parameters; cross-verify with metardu web |
| Kenya regulatory changes | Low | Statutory doc updates | Country pack architecture isolates regulatory rules |

## Open Questions for Stakeholder

1. **Sync server**: Is the sync endpoint running on `metardu.duckdns.org`? If not, when?
2. **ArdhiSasa API**: Do we have sandbox credentials for ISK verification + NLIMS submission testing?
3. **Kenya CORS**: Do we have NTRIP credentials for GNSS RTK testing in the field?
4. **Signing identity**: Who owns the Apple Developer account + Google Play Console?
5. **First pilot team**: Which surveyors will test v0.2 in the field?
