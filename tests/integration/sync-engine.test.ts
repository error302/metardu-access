/**
 * Sync engine integration tests.
 *
 * These tests run against the mock sync server (mock-sync-server/server.js).
 * Start the server before running: cd mock-sync-server && npm start
 *
 * If the server is not running, tests are skipped (not failed).
 */

import { SyncEngine, buildSession } from '../../src/lib/sync/engine';
import type { SurveyorProfile } from '../../src/types';

const MOCK_SERVER_URL = 'http://localhost:8080/sync';
const MOCK_AUTH_URL = 'http://localhost:8080/auth';

// Skip tests if the mock server is not running
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:8080/health', {
      signal: AbortSignal.timeout?.(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const maybeTest = process.env.JEST_WORKER_ID !== undefined ? test : test;

describe('SyncEngine integration with mock server', () => {
  let engine: SyncEngine;
  let apiKey: string;
  let serverAvailable: boolean;

  beforeAll(async () => {
    serverAvailable = await isServerRunning();
    if (!serverAvailable) {
      console.warn('\n⚠️  Mock sync server not running on localhost:8080.');
      console.warn('   Start it with: cd mock-sync-server && npm start\n');
      return;
    }

    // Register a test surveyor
    const email = `test-${Date.now()}@mock.local`;
    const response = await fetch(`${MOCK_AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        fullName: 'Test Surveyor',
        iskNumber: 'ISK/TEST',
        firmName: 'Test Firm',
        password: 'test',
      }),
    });
    const data = await response.json();
    apiKey = data.apiKey;

    engine = new SyncEngine(MOCK_SERVER_URL);
    await engine.setApiKey(apiKey);
  });

  afterAll(async () => {
    if (serverAvailable) {
      // Clean up: clear all data
      await fetch('http://localhost:8080/debug/reset', { method: 'DELETE' });
    }
  });

  maybeTest('checkHealth returns online status', async () => {
    if (!serverAvailable) return;
    const health = await engine.checkHealth();
    expect(health.online).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.stats).toBeDefined();
  });

  maybeTest('pushSession uploads a session to the server', async () => {
    if (!serverAvailable) return;
    const profile: SurveyorProfile = {
      id: 'test-uuid',
      email: 'test@mock.local',
      fullName: 'Test Surveyor',
      iskNumber: 'ISK/TEST',
      verifiedIsk: false,
      apiKey,
      createdAt: new Date().toISOString(),
    };
    const session = buildSession({
      surveyor: profile,
      project: {
        id: 'proj-test-1',
        name: 'Test Project',
        surveyType: 'cadastral',
        county: 'Nairobi',
      },
      points: [
        {
          pointNumber: 'P-001',
          easting: 254500.123,
          northing: 9857200.456,
          elevation: 1795.5,
          source: 'gnss',
          timestamp: new Date().toISOString(),
          sessionId: '',
          projectId: 'proj-test-1',
        },
      ],
      observations: [],
      crsEpsg: 21037,
    });

    const result = await engine.pushSession(session);
    expect(result.ok).toBe(true);
  });

  maybeTest('listSessions returns the pushed session', async () => {
    if (!serverAvailable) return;
    const sessions = await engine.listSessions({ projectId: 'proj-test-1' });
    expect(sessions.length).toBeGreaterThan(0);
    const found = sessions.find(s => s.projectId === 'proj-test-1');
    expect(found).toBeDefined();
    expect(found?.points.length ?? 0).toBeGreaterThan(0);
  });

  maybeTest('getSession returns full payload', async () => {
    if (!serverAvailable) return;
    const sessions = await engine.listSessions({ projectId: 'proj-test-1' });
    if (sessions.length === 0) return;
    const full = await engine.getSession(sessions[0].sessionId);
    expect(full.sessionId).toBe(sessions[0].sessionId);
    expect(full.points.length).toBeGreaterThan(0);
  });

  maybeTest('pushSession is idempotent (same UUID = no duplicate)', async () => {
    if (!serverAvailable) return;
    const profile: SurveyorProfile = {
      id: 'test-uuid',
      email: 'test@mock.local',
      fullName: 'Test Surveyor',
      iskNumber: 'ISK/TEST',
      verifiedIsk: false,
      apiKey,
      createdAt: new Date().toISOString(),
    };
    const session = buildSession({
      surveyor: profile,
      project: { id: 'proj-idem', name: 'Idempotent Test', surveyType: 'cadastral' },
      points: [],
      observations: [],
      crsEpsg: 21037,
    });

    const result1 = await engine.pushSession(session);
    const result2 = await engine.pushSession(session);
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);

    // Verify only one session exists
    const sessions = await engine.listSessions({ projectId: 'proj-idem' });
    expect(sessions.length).toBe(1);
  });
});
