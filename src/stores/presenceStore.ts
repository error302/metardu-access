/**
 * Presence store — tracks who's online and what they're working on.
 *
 * Powered by the realtime sync module. When other surveyors come online
 * or capture points, this store updates reactively.
 *
 * Used by:
 *   - Project detail screen (shows team avatars)
 *   - Fieldbook (live activity feed)
 *   - Map (other surveyors' positions)
 */

import { create } from 'zustand';
import {
  getRealtimeSync,
  type PresenceEvent,
  type RealtimeEvent,
} from '@/lib/realtime/sync';
import { useAuthStore } from './authStore';

interface PresenceState {
  peers: PresenceEvent[];
  realtimeConnected: boolean;
  myStatus: PresenceEvent['status'];

  initialize: () => Promise<void>;
  setStatus: (status: PresenceEvent['status']) => Promise<void>;
  setProject: (projectId: string, projectName: string) => Promise<void>;
  updateLocation: (lat: number, lng: number) => Promise<void>;
  disconnect: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  peers: [],
  realtimeConnected: false,
  myStatus: 'offline',

  initialize: async () => {
    const realtime = getRealtimeSync();
    const auth = useAuthStore.getState();

    if (!auth.profile) return;

    // Subscribe to events
    realtime.onEvent((event: RealtimeEvent) => {
      switch (event.kind) {
        case 'presence-list':
          set({ peers: event.data });
          break;
        case 'presence':
          set((state) => {
            const peers = [...state.peers];
            const idx = peers.findIndex((p) => p.surveyorId === event.data.surveyorId);
            if (idx >= 0) peers[idx] = event.data;
            else peers.push(event.data);
            return { peers };
          });
          break;
        case 'capture':
          // Could trigger a notification or update the fieldbook
          break;
      }
    });

    // Set initial presence
    await realtime.updatePresence({
      surveyorId: auth.profile.id,
      surveyorName: auth.profile.fullName,
      surveyorLicense: auth.profile.iskNumber,
      status: 'online',
    });

    // Connect
    await realtime.connect();
    set({ realtimeConnected: realtime.isConnected(), myStatus: 'online' });
  },

  setStatus: async (status) => {
    const realtime = getRealtimeSync();
    await realtime.updatePresence({ status });
    set({ myStatus: status });
  },

  setProject: async (projectId, projectName) => {
    const realtime = getRealtimeSync();
    await realtime.updatePresence({ projectId, status: 'capturing' });
    set({ myStatus: 'capturing' });
  },

  updateLocation: async (lat, lng) => {
    const realtime = getRealtimeSync();
    await realtime.updatePresence({ lat, lng });
  },

  disconnect: () => {
    const realtime = getRealtimeSync();
    realtime.disconnect();
    set({ realtimeConnected: false, myStatus: 'offline', peers: [] });
  },
}));
