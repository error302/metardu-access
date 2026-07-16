/**
 * Real-time collaboration — WebSocket-based live sync.
 *
 * When a surveyor captures a point in the field, the office sees it
 * within seconds (vs waiting for a manual sync). Multiple surveyors
 * on the same project see each other's captures in real time.
 *
 * Architecture:
 *   1. Mobile opens WebSocket connection to sync server on app launch
 *   2. Sends "presence" events: I'm online, working on project X
 *   3. Sends "capture" events: point/observation/beacon added
 *   4. Receives "capture" events from other surveyors
 *   5. Receives "presence" updates: who's online, what they're working on
 *
 * Falls back gracefully:
 *   - No network: events queued locally, sent on reconnect
 *   - Server down: silent fallback to manual sync
 *   - WebSocket unavailable (old server): falls back to REST sync
 *
 * Wire protocol (JSON over WebSocket):
 *   { type: "presence", surveyorId, projectId, status: "online"|"capturing"|"away" }
 *   { type: "capture", surveyorId, projectId, captureType: "point"|"observation", payload: {...} }
 *   { type: "sync", sessionId, payload: {...} }  // full session push
 *   { type: "ack", eventId }  // server acknowledges receipt
 *   { type: "conflict", sessionId, serverVersion, clientVersion }  // conflict detected
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSyncEngine } from '@/lib/sync/engine';

const WS_RECONNECT_BASE_MS = 1000;
const WS_RECONNECT_MAX_MS = 30_000;
const EVENT_QUEUE_KEY = 'metardu_realtime_event_queue';

export type PresenceStatus = 'online' | 'capturing' | 'away' | 'offline';

export interface PresenceEvent {
  surveyorId: string;
  surveyorName: string;
  surveyorLicense: string;
  projectId?: string;
  status: PresenceStatus;
  lastSeenAt: string;
  lat?: number;
  lng?: number;
}

export interface CaptureEvent {
  eventId: string;
  surveyorId: string;
  surveyorName: string;
  projectId: string;
  captureType: 'point' | 'observation' | 'beacon' | 'breakline-point' | 'gcp';
  payload: any;
  timestamp: string;
}

export interface ConflictEvent {
  sessionId: string;
  serverVersion: any;
  clientVersion: any;
  field: string;
  reason: string;
}

export type RealtimeEvent =
  | { kind: 'presence'; data: PresenceEvent }
  | { kind: 'capture'; data: CaptureEvent }
  | { kind: 'conflict'; data: ConflictEvent }
  | { kind: 'ack'; eventId: string }
  | { kind: 'presence-list'; data: PresenceEvent[] };

type Listener = (event: RealtimeEvent) => void;

export class RealtimeSync {
  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;
  private listeners: Listener[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private presenceList: PresenceEvent[] = [];
  private myPresence: PresenceEvent | null = null;
  private connected = false;

  /**
   * Connect to the sync server's WebSocket endpoint.
   * URL is derived from the REST sync URL (replace /sync with /realtime).
   */
  async connect(): Promise<void> {
    const engine = getSyncEngine();
    if (!engine.hasCredentials()) {
      return; // silently skip if not authenticated
    }

    const restUrl = (engine as any).apiUrl as string;
    const wsUrl = restUrl
      .replace(/^http/, 'ws')
      .replace(/\/sync\/?$/, '/realtime');

    this.wsUrl = wsUrl;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Re-send any queued events
        this.flushEventQueue();
        // Announce presence
        if (this.myPresence) {
          this.send({ type: 'presence', ...this.myPresence });
        }
        console.log('[realtime] Connected to', wsUrl);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncoming(data);
        } catch (err) {
          console.warn('[realtime] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
        // Mark all peers as offline
        this.presenceList = this.presenceList.map((p) => ({
          ...p,
          status: 'offline' as const,
        }));
        this.emit({ kind: 'presence-list', data: this.presenceList });
      };

      this.ws.onerror = (err) => {
        console.warn('[realtime] WebSocket error:', err);
      };
    } catch (err) {
      console.warn('[realtime] Connection failed:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Update my presence (online/capturing/away).
   */
  async updatePresence(presence: Partial<PresenceEvent>): Promise<void> {
    if (!this.myPresence) {
      this.myPresence = {
        surveyorId: presence.surveyorId ?? 'unknown',
        surveyorName: presence.surveyorName ?? 'Surveyor',
        surveyorLicense: presence.surveyorLicense ?? '',
        status: 'online',
        lastSeenAt: new Date().toISOString(),
      };
    }
    this.myPresence = {
      ...this.myPresence,
      ...presence,
      lastSeenAt: new Date().toISOString(),
    };

    if (this.connected) {
      this.send({ type: 'presence', ...this.myPresence });
    }
  }

  /**
   * Broadcast a capture event to other surveyors on the same project.
   */
  async broadcastCapture(event: Omit<CaptureEvent, 'eventId' | 'timestamp'>): Promise<void> {
    const fullEvent: CaptureEvent = {
      ...event,
      eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };

    if (this.connected) {
      this.send({ type: 'capture', data: fullEvent });
    } else {
      // Queue for later
      await this.queueEvent({ type: 'capture', data: fullEvent });
    }
  }

  /**
   * Subscribe to incoming events.
   */
  onEvent(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get the current presence list (who's online).
   */
  getPresenceList(): PresenceEvent[] {
    return this.presenceList;
  }

  // ========================================================================
  // Internal
  // ========================================================================
  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleIncoming(data: any): void {
    switch (data.type) {
      case 'presence':
        this.updatePresenceList(data);
        this.emit({ kind: 'presence', data });
        break;
      case 'presence-list':
        this.presenceList = data.data ?? [];
        this.emit({ kind: 'presence-list', data: this.presenceList });
        break;
      case 'capture':
        this.emit({ kind: 'capture', data: data.data });
        break;
      case 'conflict':
        this.emit({ kind: 'conflict', data: data });
        break;
      case 'ack':
        this.emit({ kind: 'ack', eventId: data.eventId });
        break;
    }
  }

  private updatePresenceList(data: any): void {
    const presence: PresenceEvent = data;
    const existing = this.presenceList.findIndex(
      (p) => p.surveyorId === presence.surveyorId
    );
    if (existing >= 0) {
      this.presenceList[existing] = presence;
    } else {
      this.presenceList.push(presence);
    }
    this.emit({ kind: 'presence-list', data: this.presenceList });
  }

  private emit(event: RealtimeEvent): void {
    this.listeners.forEach((l) => l(event));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, 30_000); // 30 second heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      WS_RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts),
      WS_RECONNECT_MAX_MS
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private async queueEvent(event: RealtimeEvent): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(EVENT_QUEUE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      queue.push(event);
      await AsyncStorage.setItem(EVENT_QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.warn('[realtime] Failed to queue event:', err);
    }
  }

  private async flushEventQueue(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(EVENT_QUEUE_KEY);
      if (!raw) return;
      const queue = JSON.parse(raw);
      for (const event of queue) {
        this.send({ type: event.kind, data: event.data });
      }
      await AsyncStorage.removeItem(EVENT_QUEUE_KEY);
    } catch (err) {
      console.warn('[realtime] Failed to flush queue:', err);
    }
  }
}

// Singleton
let realtimeInstance: RealtimeSync | null = null;

export function getRealtimeSync(): RealtimeSync {
  if (!realtimeInstance) {
    realtimeInstance = new RealtimeSync();
  }
  return realtimeInstance;
}
