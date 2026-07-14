# Metardu Mock Sync Server

A minimal in-memory sync server implementing [`SYNC_API_CONTRACT.md`](../docs/SYNC.md) for local development and testing of the Metardu Access mobile app.

**Not for production** — data is stored in memory only and lost on restart.

## Quick Start

```bash
cd mock-sync-server
npm install
npm start
```

The server listens on `http://localhost:8080` (or `PORT` env var).

## Configure the Mobile App

Create or update `.env.local` in the project root:

```bash
# If running the app in a simulator (localhost works)
EXPO_PUBLIC_SYNC_API_URL=http://localhost:8080/sync
EXPO_PUBLIC_SYNC_AUTH_URL=http://localhost:8080/auth

# If running on a physical device (use your dev machine's LAN IP)
# Find your IP: ifconfig (Mac/Linux) or ipconfig (Windows)
EXPO_PUBLIC_SYNC_API_URL=http://192.168.1.42:8080/sync
EXPO_PUBLIC_SYNC_AUTH_URL=http://192.168.1.42:8080/auth
```

Restart the Expo dev server after changing env vars.

## Endpoints

### Health (no auth)
```
GET /health
```
Returns server status and counts. The mobile app's sync engine pings this on the Profile screen to show "Sync server: online/offline".

### Auth

```
POST /auth/login
Body: { "email": "...", "password": "..." }
Returns: { "apiKey": "key_...", "fullName": "...", "iskNumber": "ISK/...", "verifiedIsk": false }
```

The mock auto-creates a surveyor on first login (matching the app's demo mode). Any email + password combination works.

```
POST /auth/register
Body: { "email", "fullName", "iskNumber", "firmName", "password" }
Returns: { "apiKey", "userId", "fullName", "iskNumber", "verifiedIsk" }
```

```
GET /auth/me
Headers: Authorization: Bearer <api-key>
Returns: { "id", "email", "fullName", "iskNumber", "verifiedIsk", "firmName" }
```

### Sync (auth required)

```
GET /sync/sessions?surveyorId=<uuid>&projectId=<uuid>&since=<iso-date>
Headers: Authorization: Bearer <api-key>
Returns: { "sessions": [...], "count": N }
```

```
GET /sync/sessions/:id
Headers: Authorization: Bearer <api-key>
Returns: full session payload (points, observations, etc.)
```

```
POST /sync/sessions
Headers: Authorization: Bearer <api-key>
Body: full field session JSON (per SYNC_API_CONTRACT.md)
Returns: { "ok": true, "sessionId": "...", "syncedAt": "..." }
```

The endpoint is **idempotent** — pushing the same `sessionId` twice returns 200 OK without overwriting.

### Audit Log

```
GET /audit/:entityId
Headers: Authorization: Bearer <api-key>
Returns: { "entries": [...], "count": N }
```

### Debug (dev only)

```
GET  /debug/sessions     — list all stored sessions (summary)
GET  /debug/surveyors    — list all registered surveyors
DELETE /debug/reset      — clear all data
```

## How to Test End-to-End

1. Start the mock server: `npm start`
2. Start the mobile app: `npm run start` (in project root)
3. In the app, sign in with any email + password
4. Create a project
5. Capture a GPS point (Fieldbook tab → Capture GPS)
6. Open the project → tap "Sync Queue" → tap "Sync Now"
7. Verify on the server:
   ```bash
   curl http://localhost:8080/debug/sessions
   ```
8. You should see your captured session in the response

## Production Sync Server

For production, you'll want to:

1. Replace in-memory storage with PostgreSQL (same schema as metardu web)
2. Validate API keys against ArdhiSasa credentials (not just accept any)
3. Add HTTPS (use a reverse proxy like Caddy or nginx)
4. Add rate limiting
5. Add file storage for photos (S3 / GCS)
6. Add WebSocket support for live sync (rather than polling)
7. Implement ISK verification via the ISK API

The metardu web app (`https://github.com/error302/metardu`) already has PostgreSQL + NextAuth + RBAC. The natural production path is to add `/api/sync/*` routes to the web app, reusing its existing auth and database. This mock server exists only so you can develop the mobile app without standing up the full web stack.

## License

MIT
