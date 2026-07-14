/**
 * Metardu Access — Sync Engine
 * Implements the contract documented in metardu-desktop/docs/SYNC_API_CONTRACT.md
 *
 * Endpoints:
 *   GET  /sessions                — list field sessions (filters: surveyorId, projectId, since)
 *   GET  /sessions/:id            — full session with points + observations
 *   POST /sessions                — bidirectional push from client back to server
 *
 * Auth: Bearer <api-key> per surveyor, stored in expo-secure-store.
 *
 * Offline fallback: export .field-session JSON file (matches API response shape).
 */

import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import type { FieldSession, SurveyorProfile, SyncQueueItem } from '@/types';
import {
  enqueueSync,
  getSyncQueue,
  markSynced,
  markSyncFailed,
} from '@/lib/db/queries';

const API_KEY_STORAGE = 'metardu_sync_api_key';
const SYNC_API_URL = process.env.EXPO_PUBLIC_SYNC_API_URL || 'https://metardu.duckdns.org/api/sync';

export class SyncEngine {
  private apiUrl: string;
  private apiKey: string | null = null;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || SYNC_API_URL;
  }

  async init(): Promise<void> {
    this.apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE);
  }

  async setApiKey(key: string): Promise<void> {
    this.apiKey = key;
    await SecureStore.setItemAsync(API_KEY_STORAGE, key);
  }

  async clearApiKey(): Promise<void> {
    this.apiKey = null;
    await SecureStore.deleteItemAsync(API_KEY_STORAGE);
  }

  hasCredentials(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  // ==========================================================================
  // Network status
  // ==========================================================================
  async isOnline(): Promise<boolean> {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable);
  }

  /**
   * Health check — ping the sync server to verify it's reachable.
   * Used by the Profile screen to show "Sync server: online/offline".
   */
  async checkHealth(): Promise<{ online: boolean; latencyMs?: number; stats?: any }> {
    const start = Date.now();
    try {
      // Health endpoint is at the server root, not under /sync
      const healthUrl = this.apiUrl.replace(/\/sync\/?$/, '') + '/health';
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        // Short timeout for health check
        signal: AbortSignal.timeout?.(5000),
      });
      if (!response.ok) {
        return { online: false };
      }
      const data = await response.json();
      return {
        online: true,
        latencyMs: Date.now() - start,
        stats: data.stats ?? data,
      };
    } catch {
      return { online: false };
    }
  }

  // ==========================================================================
  // Push: upload a field session to the sync server
  // ==========================================================================
  async pushSession(session: FieldSession): Promise<{ ok: boolean; error?: string }> {
    if (!this.apiKey) {
      return { ok: false, error: 'No API key configured. Sign in first.' };
    }

    // Always enqueue locally first (idempotent by session_id)
    await enqueueSync(session);

    const online = await this.isOnline();
    if (!online) {
      return { ok: false, error: 'Offline — session queued for sync when online.' };
    }

    try {
      const response = await fetch(`${this.apiUrl}/sessions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(session),
      });

      if (!response.ok) {
        const text = await response.text();
        await markSyncFailed(session.sessionId, `HTTP ${response.status}: ${text}`);
        return { ok: false, error: `Server returned ${response.status}` };
      }

      await markSynced(session.sessionId);
      return { ok: true };
    } catch (err: any) {
      await markSyncFailed(session.sessionId, err.message ?? String(err));
      return { ok: false, error: err.message ?? 'Network error' };
    }
  }

  // ==========================================================================
  // Pull: fetch sessions from the sync server
  // ==========================================================================
  async listSessions(
    filters: { surveyorId?: string; projectId?: string; since?: string } = {}
  ): Promise<FieldSession[]> {
    if (!this.apiKey) {
      throw new Error('No API key configured');
    }
    const params = new URLSearchParams();
    if (filters.surveyorId) params.set('surveyorId', filters.surveyorId);
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.since) params.set('since', filters.since);

    const url = `${this.apiUrl}/sessions${params.toString() ? `?${params}` : ''}`;
    const response = await fetch(url, { headers: this.headers() });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.sessions ?? [];
  }

  async getSession(sessionId: string): Promise<FieldSession> {
    if (!this.apiKey) {
      throw new Error('No API key configured');
    }
    const response = await fetch(`${this.apiUrl}/sessions/${sessionId}`, {
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  // ==========================================================================
  // Drain queue: push all pending sessions
  // ==========================================================================
  async drainQueue(
    onProgress?: (item: SyncQueueItem, ok: boolean, error?: string) => void
  ): Promise<{ pushed: number; failed: number }> {
    const queue = await getSyncQueue();
    let pushed = 0;
    let failed = 0;

    for (const item of queue) {
      const result = await this.pushSession(item.payload);
      if (result.ok) {
        pushed++;
        onProgress?.(item, true);
      } else {
        failed++;
        onProgress?.(item, false, result.error);
      }
    }

    return { pushed, failed };
  }

  // ==========================================================================
  // Offline export: write .field-session JSON to a file (USB/email fallback)
  // ==========================================================================
  async exportSessionToFile(session: FieldSession): Promise<string> {
    const safeName = session.projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${safeName}-${session.sessionId.slice(0, 8)}.field-session.json`;
    const dir = FileSystem.documentDirectory + 'exports/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const path = dir + filename;

    await FileSystem.writeAsStringAsync(
      path,
      JSON.stringify(session, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );

    return path;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================
  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client': `metardu-access/${Platform.OS}/${Platform.Version}`,
    };
  }
}

// Singleton instance
let syncEngineInstance: SyncEngine | null = null;

export function getSyncEngine(): SyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine();
  }
  return syncEngineInstance;
}

export async function initSyncEngine(): Promise<SyncEngine> {
  const engine = getSyncEngine();
  await engine.init();
  return engine;
}

// Utility: build a FieldSession from local data
export function buildSession(input: {
  surveyor: SurveyorProfile;
  project: { id: string; name: string; surveyType: any; county?: string };
  points: any[];
  observations: any[];
  crsEpsg: number;
  station?: any;
  instrument?: any;
  notes?: string;
}): FieldSession {
  return {
    sessionId: uuidv4(),
    surveyorId: input.surveyor.id,
    surveyorName: input.surveyor.fullName,
    surveyorLicense: input.surveyor.iskNumber,
    projectName: input.project.name,
    projectId: input.project.id,
    county: input.project.county,
    surveyType: input.project.surveyType,
    startDate: new Date().toISOString(),
    points: input.points,
    observations: input.observations,
    crs: {
      epsg: input.crsEpsg,
      name: input.crsEpsg === 21037 ? 'Arc 1960 / UTM zone 37S' : `EPSG:${input.crsEpsg}`,
      datum: 'ARC1960',
    },
    syncStatus: 'pending',
    notes: input.notes,
    station: input.station,
    instrument: input.instrument,
  };
}
