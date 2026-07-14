# Metardu Access — Sync Implementation

This document describes how Metardu Access implements the sync contract documented in [`metardu-desktop/docs/SYNC_API_CONTRACT.md`](https://github.com/error302/metardu-desktop/blob/main/docs/SYNC_API_CONTRACT.md).

## Contract Summary

The sync contract defines a **hub-and-spoke field→office sync** between three actors:

```
metardu-access (mobile, field)  ──push──▶  Sync Server  ──pull──▶  metardu-desktop (office)
                                ◀──pull──                ──push──▶
```

- Mobile **pushes** completed field sessions (UUID-identified) when online
- Mobile can **pull** sessions from other devices (rare; usually desktop's job)
- Desktop **pulls** on launch + every 5 min; dedups by session ID
- Points are **immutable once synced**
- Desktop is **source of truth for computed/adjusted data** (traverse adjustment, deed plans)

## Endpoints

### `POST /sessions` — Push a field session

**Request**:
```http
POST /api/sync/sessions
Authorization: Bearer <api-key>
Content-Type: application/json
X-Client: metardu-access/ios/17.0

{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "surveyorId": "uuid",
  "surveyorName": "John Doe",
  "surveyorLicense": "ISK/1234",
  "projectName": "LR 12345/6 Boundary Survey",
  "projectId": "uuid",
  "county": "Nairobi",
  "surveyType": "cadastral",
  "startDate": "2026-07-14T08:00:00.000Z",
  "endDate": "2026-07-14T17:30:00.000Z",
  "instrument": {
    "type": "total_station",
    "brand": "Trimble",
    "model": "S5",
    "serialNumber": "TS-12345"
  },
  "station": {
    "stationNumber": "STN-001",
    "easting": 254500.123,
    "northing": 9857200.456,
    "elevation": 1795.50,
    "backsight": "BM-001",
    "instrumentHeight": 1.500
  },
  "points": [
    {
      "pointNumber": "P-001",
      "easting": 254520.789,
      "northing": 9857210.012,
      "elevation": 1795.55,
      "code": "BUILD",
      "description": "Building corner",
      "source": "total_station",
      "timestamp": "2026-07-14T09:15:00.000Z",
      "raw": { "rawHorizontalAngle": 145.3214, "rawSlopeDistance": 25.327 }
    }
  ],
  "observations": [
    {
      "fromPoint": "STN-001",
      "toPoint": "P-001",
      "distance": 25.327,
      "bearing": 145.3214,
      "verticalAngle": 90.0125,
      "face": "left",
      "timestamp": "2026-07-14T09:15:00.000Z"
    }
  ],
  "crs": {
    "epsg": 21037,
    "name": "Arc 1960 / UTM zone 37S",
    "datum": "ARC1960"
  },
  "syncStatus": "synced",
  "syncedAt": "2026-07-14T17:35:00.000Z"
}
```

**Response**: `200 OK` (or `409 Conflict` if session UUID already exists — treated as success, idempotent)

### `GET /sessions` — List sessions

**Request**:
```http
GET /api/sync/sessions?surveyorId=<uuid>&projectId=<uuid>&since=2026-07-01T00:00:00.000Z
Authorization: Bearer <api-key>
```

**Response**:
```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "projectName": "...",
      "startDate": "...",
      "syncStatus": "synced",
      "syncedAt": "..."
    }
  ]
}
```

### `GET /sessions/:id` — Fetch full session

Returns the same shape as the POST body above.

## Authentication

- **Bearer API key** per surveyor
- Stored in `expo-secure-store` (iOS Keychain / Android Keystore)
- Never written to Zustand state, AsyncStorage, or SQLite
- Validated against ArdhiSasa credentials server-side (ArdhiSasa is Kenya's official land portal)
- One API key per surveyor; can be revoked server-side

## Implementation in Metardu Access

### Sync Engine (`src/lib/sync/engine.ts`)

The `SyncEngine` class provides:

| Method | Purpose |
|--------|---------|
| `init()` | Load API key from secure store |
| `setApiKey(key)` | Save API key to secure store |
| `clearApiKey()` | Remove API key (sign out) |
| `hasCredentials()` | Check if API key is present |
| `isOnline()` | Check network connectivity via `expo-network` |
| `pushSession(session)` | POST a session; enqueue locally first, then push if online |
| `listSessions(filters)` | GET /sessions with optional filters |
| `getSession(id)` | GET /sessions/:id |
| `drainQueue(onProgress)` | Iterate sync_queue table, push each pending session |
| `exportSessionToFile(session)` | Write `.field-session.json` to FileSystem.documentDirectory |

### Sync Queue (`sync_queue` SQLite table)

When a session is captured:

1. Session is written to `field_sessions` table with `sync_status = 'pending'`
2. If autoSync is on AND online → `SyncEngine.pushSession()` immediately
3. If offline → session is added to `sync_queue` table with `attempts = 0`
4. Background task (`expo-background-fetch`) drains queue periodically
5. User can manually trigger drain from Sync Queue screen
6. On success: `DELETE FROM sync_queue WHERE session_id = ?` + `UPDATE field_sessions SET sync_status = 'synced', synced_at = ?`
7. On failure: increment `attempts`, store `last_error`, set `sync_status = 'failed'`

### Conflict Resolution

Per the contract:
- Sessions are **UUID-keyed** — no conflicts possible (each push is idempotent)
- Points within a session are **immutable** — never edited after creation
- Desktop is **source of truth for computed/adjusted data** — mobile never sends adjusted coordinates
- If the server already has a session with the same UUID: return `409 Conflict` (mobile treats as success)

### Offline Fallback: `.field-session` JSON Export

If no sync server is available (or for manual transfer):

1. User taps **"Export .field-session File"** on Sync Queue screen
2. `SyncEngine.exportSessionToFile()` builds the session JSON (same shape as POST body)
3. JSON is written to `FileSystem.documentDirectory + 'exports/<project>-<session>.field-session.json'`
4. iOS `Share` sheet opens — user can send via AirDrop, email, WhatsApp, or save to Files app
5. On desktop, user clicks **"Import File"** and selects the `.field-session.json` — no conversion needed

This fallback is critical for field scenarios where:
- No cellular signal (Kenya rural areas)
- Sync server is down
- Surveyor wants to immediately transfer data to a colleague's desktop
- Compliance audit requires a physical file artifact

## Configuration

Environment variables (see `.env.example`):

```bash
EXPO_PUBLIC_SYNC_API_URL=https://metardu.duckdns.org/api/sync
EXPO_PUBLIC_SYNC_AUTH_URL=https://metardu.duckdns.org/api/auth
```

In demo mode (no server reachable), the app generates a `dev_<uuid>` API key locally so the UI flow can be tested end-to-end. Real sync requires a server implementing the contract above.

## Testing Sync

### Manual test (offline mode)

1. Sign in with any email + password (demo mode activates)
2. Create a project
3. Capture a GPS point (Fieldbook → Quick Capture → GPS)
4. Go to Sync Queue → "Export .field-session File"
5. Inspect the JSON — verify shape matches the contract above

### Integration test (with server)

1. Deploy sync server implementing the contract
2. Set `EXPO_PUBLIC_SYNC_API_URL` env var
3. Sign in with real credentials (server returns API key)
4. Capture points
5. Tap "Sync Now" on Sync Queue screen
6. Verify `field_sessions.sync_status` updates to `synced`
7. On desktop, verify the session appears in the desktop's sync pull

## Roadmap

### v0.1 (current)
- ✅ Sync engine class
- ✅ Sync queue table + drain
- ✅ `.field-session` JSON export
- ✅ Offline demo mode

### v0.2
- [ ] Background sync via `expo-background-fetch` (every 15 min when online)
- [ ] Real API integration with metardu web's `/api/sync/*` routes
- [ ] Crypto-sealed sessions (RSA-2048 signature in `X-Signature` header)
- [ ] Sync conflict UI (rare, but show user-friendly message)
- [ ] Pull from server (for multi-device scenarios)

### v0.3
- [ ] Bidirectional sync (mobile can pull sessions captured on other devices)
- [ ] Selective sync (per-project, per-date-range)
- [ ] Bandwidth-aware sync (WiFi-only option)
