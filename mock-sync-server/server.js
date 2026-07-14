/**
 * Metardu Access — Mock Sync Server
 *
 * Implements the sync contract documented in metardu-desktop/docs/SYNC_API_CONTRACT.md
 * for local development and testing of the Metardu Access mobile app.
 *
 * NOT FOR PRODUCTION — data is stored in memory only. Restart loses all data.
 *
 * Endpoints:
 *   GET  /health                — health check (no auth)
 *   POST /auth/login            — surveyor login, returns API key
 *   POST /auth/register         — surveyor registration, returns API key
 *   GET  /auth/me               — current surveyor info
 *   GET  /sessions              — list sessions (auth required)
 *   GET  /sessions/:id          — get a single session (auth required)
 *   POST /sessions              — push a session (auth required, idempotent by UUID)
 *   GET  /audit/:entityId       — fetch audit log for an entity (auth required)
 *
 * Auth: Bearer <api-key> header. The mock accepts any non-empty API key,
 * but issues real UUIDs on login/register for realism.
 *
 * Run:
 *   npm install
 *   npm start
 *
 * The server listens on http://localhost:8080 by default.
 * Set PORT env var to change.
 *
 * Configure the mobile app to use this server by setting in .env.local:
 *   EXPO_PUBLIC_SYNC_API_URL=http://localhost:8080/sync
 *   EXPO_PUBLIC_SYNC_AUTH_URL=http://localhost:8080/auth
 *
 * If running on a physical device, use your dev machine's LAN IP instead of localhost:
 *   EXPO_PUBLIC_SYNC_API_URL=http://192.168.1.42:8080/sync
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================================
// In-memory stores
// ============================================================================
const surveyors = new Map();      // apiKey -> surveyor profile
const surveyorsByEmail = new Map(); // email -> surveyor profile
const sessions = new Map();       // sessionId -> session payload
const sessionsByProject = new Map(); // projectId -> Set of sessionIds
const auditLogs = new Map();      // entityId -> array of audit entries

// ============================================================================
// Auth middleware
// ============================================================================
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const apiKey = auth.slice(7);
  if (!apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  const surveyor = surveyors.get(apiKey);
  if (!surveyor) {
    // Mock permissiveness: accept any API key as a generic surveyor
    // (so you can test sync without registering first)
    req.surveyor = {
      id: 'anon-' + apiKey.slice(0, 8),
      email: 'anonymous@mock.local',
      fullName: 'Anonymous Surveyor',
      iskNumber: 'ISK/MOCK',
      verifiedIsk: false,
      apiKey,
    };
    return next();
  }
  req.surveyor = surveyor;
  next();
}

// ============================================================================
// Health check
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'metardu-mock-sync-server',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    stats: {
      surveyors: surveyors.size,
      sessions: sessions.size,
      auditEntries: Array.from(auditLogs.values()).reduce((s, a) => s + a.length, 0),
    },
  });
});

// ============================================================================
// Auth endpoints
// ============================================================================
app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  let surveyor = surveyorsByEmail.get(email);
  if (!surveyor) {
    // Auto-create on first login (matches mobile's demo mode)
    surveyor = {
      id: uuidv4(),
      email,
      fullName: email.split('@')[0],
      iskNumber: 'ISK/DEMO',
      verifiedIsk: false,
      apiKey: 'key_' + uuidv4(),
      createdAt: new Date().toISOString(),
    };
    surveyors.set(surveyor.apiKey, surveyor);
    surveyorsByEmail.set(email, surveyor);
    console.log(`[mock] Auto-created surveyor: ${email}`);
  }

  res.json({
    apiKey: surveyor.apiKey,
    userId: surveyor.id,
    fullName: surveyor.fullName,
    iskNumber: surveyor.iskNumber,
    verifiedIsk: surveyor.verifiedIsk,
    firmName: surveyor.firmName,
  });
});

app.post('/auth/register', (req, res) => {
  const { email, fullName, iskNumber, firmName, password } = req.body;
  if (!email || !fullName || !iskNumber || !password) {
    return res.status(400).json({ error: 'email, fullName, iskNumber, password required' });
  }
  if (surveyorsByEmail.has(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const surveyor = {
    id: uuidv4(),
    email,
    fullName,
    iskNumber,
    firmName,
    verifiedIsk: false, // mock: would verify via ISK API in production
    apiKey: 'key_' + uuidv4(),
    createdAt: new Date().toISOString(),
  };
  surveyors.set(surveyor.apiKey, surveyor);
  surveyorsByEmail.set(email, surveyor);
  console.log(`[mock] Registered surveyor: ${email} (${iskNumber})`);

  res.status(201).json({
    apiKey: surveyor.apiKey,
    userId: surveyor.id,
    fullName: surveyor.fullName,
    iskNumber: surveyor.iskNumber,
    verifiedIsk: surveyor.verifiedIsk,
  });
});

app.get('/auth/me', requireAuth, (req, res) => {
  res.json({
    id: req.surveyor.id,
    email: req.surveyor.email,
    fullName: req.surveyor.fullName,
    iskNumber: req.surveyor.iskNumber,
    verifiedIsk: req.surveyor.verifiedIsk,
    firmName: req.surveyor.firmName,
  });
});

// ============================================================================
// Session sync endpoints
// ============================================================================
app.get('/sync/sessions', requireAuth, (req, res) => {
  const { surveyorId, projectId, since } = req.query;
  let results = Array.from(sessions.values());

  if (surveyorId) {
    results = results.filter(s => s.surveyorId === surveyorId);
  }
  if (projectId) {
    results = results.filter(s => s.projectId === projectId);
  }
  if (since) {
    const sinceDate = new Date(since);
    results = results.filter(s => new Date(s.startDate) >= sinceDate);
  }

  // Return summary (not full payloads)
  res.json({
    sessions: results.map(s => ({
      sessionId: s.sessionId,
      surveyorId: s.surveyorId,
      surveyorName: s.surveyorName,
      projectName: s.projectName,
      projectId: s.projectId,
      surveyType: s.surveyType,
      startDate: s.startDate,
      endDate: s.endDate,
      syncStatus: 'synced',
      syncedAt: s.syncedAt,
      pointCount: s.points?.length ?? 0,
      observationCount: s.observations?.length ?? 0,
    })),
    count: results.length,
  });
});

app.get('/sync/sessions/:id', requireAuth, (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

app.post('/sync/sessions', requireAuth, (req, res) => {
  const session = req.body;
  if (!session.sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }

  // Idempotent: if session already exists, treat as success (no overwrite)
  if (sessions.has(session.sessionId)) {
    console.log(`[mock] Duplicate push for session ${session.sessionId} (idempotent OK)`);
    return res.status(200).json({
      ok: true,
      sessionId: session.sessionId,
      message: 'Session already synced (idempotent)',
      syncedAt: sessions.get(session.sessionId).syncedAt,
    });
  }

  // Stamp with server-side metadata
  const stored = {
    ...session,
    syncStatus: 'synced',
    syncedAt: new Date().toISOString(),
    receivedFrom: req.surveyor.id,
    receivedAt: new Date().toISOString(),
  };

  sessions.set(session.sessionId, stored);

  // Index by project for faster lookup
  if (session.projectId) {
    if (!sessionsByProject.has(session.projectId)) {
      sessionsByProject.set(session.projectId, new Set());
    }
    sessionsByProject.get(session.projectId).add(session.sessionId);
  }

  // Audit log entry
  if (!auditLogs.has(session.sessionId)) {
    auditLogs.set(session.sessionId, []);
  }
  auditLogs.get(session.sessionId).push({
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action: 'sync_session',
    entityId: session.sessionId,
    entityType: 'field_session',
    userId: req.surveyor.id,
    metadata: {
      pointCount: session.points?.length ?? 0,
      observationCount: session.observations?.length ?? 0,
      surveyType: session.surveyType,
    },
  });

  console.log(
    `[mock] Received session ${session.sessionId.slice(0, 8)} from ${req.surveyor.email} — ` +
    `${session.points?.length ?? 0} points, ${session.observations?.length ?? 0} observations`
  );

  res.status(201).json({
    ok: true,
    sessionId: session.sessionId,
    syncedAt: stored.syncedAt,
  });
});

// ============================================================================
// Audit log endpoint
// ============================================================================
app.get('/audit/:entityId', requireAuth, (req, res) => {
  const entries = auditLogs.get(req.params.entityId) ?? [];
  res.json({ entries, count: entries.length });
});

// ============================================================================
// Debug endpoints (dev only — never expose in production)
// ============================================================================
app.get('/debug/sessions', (req, res) => {
  res.json({
    count: sessions.size,
    sessions: Array.from(sessions.values()).map(s => ({
      sessionId: s.sessionId,
      projectName: s.projectName,
      surveyorName: s.surveyorName,
      pointCount: s.points?.length ?? 0,
      syncedAt: s.syncedAt,
    })),
  });
});

app.get('/debug/surveyors', (req, res) => {
  res.json({
    count: surveyors.size,
    surveyors: Array.from(surveyors.values()).map(s => ({
      id: s.id,
      email: s.email,
      fullName: s.fullName,
      iskNumber: s.iskNumber,
      verifiedIsk: s.verifiedIsk,
    })),
  });
});

app.delete('/debug/reset', (req, res) => {
  surveyors.clear();
  surveyorsByEmail.clear();
  sessions.clear();
  sessionsByProject.clear();
  auditLogs.clear();
  console.log('[mock] All data cleared');
  res.json({ ok: true, message: 'All data cleared' });
});

// ============================================================================
// 404 handler
// ============================================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ============================================================================
// Start
// ============================================================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  Metardu Mock Sync Server                                ║`);
  console.log(`║  Listening on http://localhost:${PORT}                    ║`);
  console.log(`║  Health:   GET  /health                                   ║`);
  console.log(`║  Login:    POST /auth/login                               ║`);
  console.log(`║  Register: POST /auth/register                            ║`);
  console.log(`║  Push:     POST /sync/sessions                            ║`);
  console.log(`║  List:     GET  /sync/sessions                            ║`);
  console.log(`║                                                          ║`);
  console.log(`║  Configure the app:                                       ║`);
  console.log(`║  EXPO_PUBLIC_SYNC_API_URL=http://<this-ip>:${PORT}/sync    ║`);
  console.log(`║  EXPO_PUBLIC_SYNC_AUTH_URL=http://<this-ip>:${PORT}/auth    ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
