# Metardu Access — Release Runbook

This document describes the build, signing, distribution, and rollout process for Metardu Access.

## Prerequisites

### Accounts

- **Apple Developer Program** ($99/year) — for iOS App Store distribution
- **Google Play Console** ($25 one-time) — for Android Play Store distribution
- **Expo EAS** (free tier sufficient for development; production builds require paid tier for faster builds)

### Tools

- `eas-cli` (installed via `npm install -g eas-cli`)
- `fastlane` (optional, for store metadata automation)
- Xcode 15+ (Mac only, for iOS local builds if needed)
- Android Studio (for Android local builds if needed)

### Secrets (set in EAS)

- `EXPO_PUBLIC_SYNC_API_URL` — production sync server URL
- `EXPO_PUBLIC_SYNC_AUTH_URL` — production auth server URL
- `EXPO_PUBLIC_DEFAULT_COUNTRY_PACK` — `KEN`
- `EXPO_PUBLIC_DEFAULT_CRS_EPSG` — `21037`
- `EXPO_PUBLIC_SENTRY_DSN` — Sentry project DSN
- `SENTRY_AUTH_TOKEN` — for uploading debug symbols

## Build Profiles

Three EAS build profiles are defined in `eas.json`:

### `development`
- For local testing with Expo Go dev client
- Includes dev menu, debugging
- Internal distribution only

### `preview`
- For TestFlight (iOS) + Play Internal Testing (Android)
- Production-like build without store submission
- Signed with distribution cert

### `production`
- For App Store + Play Store submission
- No dev tools
- Minified, optimized
- Auto-submits to stores after build

## Build Commands

```bash
# Configure EAS (first time only)
eas login
eas build:configure

# Development build (for testing on your device)
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build (TestFlight + Play Internal)
npm run build:preview   # both platforms

# Production build (store submission)
npm run build:ios       # iOS App Store
npm run build:android   # Android Play Store
```

## Signing

### iOS

- **Distribution certificate**: managed by EAS (`eas credentials`)
- **Provisioning profile**: managed by EAS
- **App ID**: `org.metardu.access` (set in `app.config.ts` → `ios.bundleIdentifier`)
- **Capabilities**: Background modes (location, fetch, bluetooth-central)

For local signing (if EAS is unavailable):
```bash
# Run on a connected device
npm run ios -- --device
```

### Android

- **Play App Signing**: enabled (Google holds the upload key)
- **Upload key**: stored in EAS or local keystore
- **Package name**: `org.metardu.access` (set in `app.config.ts` → `android.package`)
- **Permissions**: see `app.config.ts` → `android.permissions` for full list

## Store Submission

### iOS (App Store)

1. Build: `npm run build:ios`
2. EAS auto-submits to App Store Connect
3. In App Store Connect:
   - Add screenshots (6.7" iPhone + 12.9" iPad)
   - Fill in App Review Information (ISK contact, demo account)
   - Submit for review
4. Review typically takes 24-48 hours
5. Once approved, release with phased rollout

### Android (Play Store)

1. Build: `npm run build:android`
2. EAS auto-submits to Play Console
3. In Play Console:
   - Add screenshots (phone + tablet)
   - Fill in Data Safety form (location, photos, BLE)
   - Set content rating (Everyone)
   - Submit for review
4. Review typically takes 2-4 hours
5. Once approved, release with staged rollout

## Phased Rollout

Following the agency-agents Mobile Release Engineer agent's protocol:

### iOS (7-day ramp)
- Day 1: 1% of users
- Day 2: 2%
- Day 3: 5%
- Day 4: 10%
- Day 5: 25%
- Day 6: 50%
- Day 7: 100%

### Android (staged rollout)
- Day 1: 1%
- Day 2: 5%
- Day 3: 20%
- Day 4: 50%
- Day 5: 100%

### Halt Criteria

**Auto-halt** if any of these thresholds are breached:
- Crash-free sessions < 99.5%
- ANR rate > 0.47% (Android)
- P0 regression reported by users
- Sentry spike (>2x baseline error rate)

**Manual halt** if:
- User reviews drop below 4.0 stars
- Critical statutory compliance issue (e.g., wrong CRS used)

## OTA Updates (EAS Update)

For hotfixes that don't require native code changes (JS-only):

```bash
# Push a hotfix to production
npm run update

# Push to staging for testing first
npm run update:staging
```

OTA updates bypass App Store / Play Store review. Use for:
- Bug fixes
- UI tweaks
- New survey-type workflow screens (since they're JS)
- Updated translations

**Do NOT use OTA for**:
- New native modules (requires store update)
- Permission changes (requires store update)
- App icon / splash changes (requires store update)

## Pre-Submission Checklist

Before each release:

- [ ] Bump version in `package.json` and `app.config.ts`
- [ ] Update `CHANGELOG.md`
- [ ] Run `npm run lint` — no errors
- [ ] Run `npm run typecheck` — no errors
- [ ] Run `npm test` — all tests pass
- [ ] Manual smoke test on physical iOS device
- [ ] Manual smoke test on physical Android device
- [ ] Verify Sentry DSN is set in EAS environment
- [ ] Verify signing identity is current
- [ ] Verify app icon and splash render correctly
- [ ] Test offline mode (airplane mode)
- [ ] Test sync with staging server
- [ ] Test `.field-session` export
- [ ] Verify all 4 survey type workflows accessible
- [ ] Verify i18n (English + Swahili both render)
- [ ] Verify audit log entries are created
- [ ] Take fresh screenshots for store listings
- [ ] Update store description if needed

## Version Numbering

We follow **SemVer** (`MAJOR.MINOR.PATCH`):

- **MAJOR** (e.g., 1.0.0 → 2.0.0): breaking changes, complete rewrites
- **MINOR** (e.g., 1.0.0 → 1.1.0): new features (new survey types, new workflows)
- **PATCH** (e.g., 1.0.0 → 1.0.1): bug fixes, hotfixes

**Build numbers** are auto-incremented by EAS and never reused.

## Debug Symbols

Every production build must upload debug symbols to Sentry:

- **iOS**: dSYMs uploaded automatically by EAS post-build
- **Android**: `mapping.txt` uploaded automatically by EAS post-build

Verify in Sentry dashboard: Project Settings → Debug Information Files

## Rollback Plan

### OTA rollback (JS-only issues)

```bash
# Roll back to the previous update
eas update --branch production --message "Rollback to <previous-version>"
```

### Store rollback (native issues)

1. **iOS**: In App Store Connect → App → Activity → Previous builds → Release previous version
2. **Android**: In Play Console → App bundle explorer → Roll back release

Rollback takes 1-4 hours to propagate.

## Monitoring Post-Launch

- **Sentry**: crash reports, performance monitoring
- **App Store Connect**: sales, crashes, reviews
- **Play Console**: installs, crashes, ANRs, reviews
- **Metardu web admin**: sync server logs (sessions pushed, sync failures)

Weekly review of:
- Crash-free session rate (target: > 99.5%)
- Top crash sources
- User reviews (respond within 24h to negative reviews)
- Sync success rate
- Active users / retention

## Emergency Contacts

- **Surveyor support**: support@metardu.duckdns.org
- **Crash response**: on-call engineer via Sentry alerts
- **ArdhiSasa integration issues**: ISK liaison
- **App Store / Play Store appeals**: file via respective developer portals
