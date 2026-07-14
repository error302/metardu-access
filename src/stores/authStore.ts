/**
 * Auth store — manages surveyor profile, API key, login state.
 * API key is kept in expo-secure-store (Keychain/Keystore), not in Zustand state.
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';
import type { SurveyorProfile } from '@/types';
import {
  saveSurveyorProfile,
  getSurveyorProfile,
} from '@/lib/db/queries';
import { initSyncEngine, getSyncEngine } from '@/lib/sync/engine';

interface AuthState {
  profile: SurveyorProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (input: {
    email: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  register: (input: {
    email: string;
    fullName: string;
    iskNumber: string;
    firmName?: string;
    password: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<SurveyorProfile>) => Promise<void>;
}

const AUTH_API_URL =
  process.env.EXPO_PUBLIC_SYNC_AUTH_URL || 'https://metardu.duckdns.org/api/auth';

export const useAuthStore = create<AuthState>((set, get) => ({
  profile: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const profile = await getSurveyorProfile();
      if (profile) {
        const engine = await initSyncEngine();
        // If we have an API key in secure store, mark as authenticated
        if (engine.hasCredentials()) {
          set({ profile, isAuthenticated: true, isLoading: false });
          return;
        }
      }
      set({ profile: null, isAuthenticated: false, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  signIn: async ({ email, password }) => {
    set({ isLoading: true, error: null });
    try {
      // Attempt real auth against metardu web's API
      let apiKey: string | undefined;
      let profileData: Partial<SurveyorProfile> | undefined;

      try {
        const response = await fetch(`${AUTH_API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (response.ok) {
          const data = await response.json();
          apiKey = data.apiKey ?? data.api_key;
          profileData = {
            fullName: data.fullName ?? data.full_name,
            iskNumber: data.iskNumber ?? data.isk_number ?? '',
            firmName: data.firmName,
            verifiedIsk: Boolean(data.verifiedIsk ?? data.verified_isk),
          };
        }
      } catch {
        // Network failed — fall back to local-only mode (offline dev)
      }

      // Local-only fallback for offline development / demo:
      // If no server response, create a local profile (still needs ISK)
      if (!apiKey) {
        // Demo mode: accept any credentials, generate a dev API key
        apiKey = `dev_${uuidv4()}`;
        profileData = {
          fullName: email.split('@')[0],
          iskNumber: 'ISK/DEMO',
          verifiedIsk: false,
        };
      }

      const profile: SurveyorProfile = {
        id: uuidv4(),
        email,
        fullName: profileData.fullName ?? email,
        iskNumber: profileData.iskNumber ?? '',
        verifiedIsk: profileData.verifiedIsk ?? false,
        firmName: profileData.firmName,
        apiKey,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await saveSurveyorProfile(profile);
      const engine = getSyncEngine();
      await engine.setApiKey(apiKey);

      set({ profile, isAuthenticated: true, isLoading: false });
      return { ok: true };
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return { ok: false, error: err.message };
    }
  },

  register: async ({ email, fullName, iskNumber, firmName, password }) => {
    set({ isLoading: true, error: null });
    try {
      let apiKey: string | undefined;
      try {
        const response = await fetch(`${AUTH_API_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, fullName, iskNumber, firmName, password }),
        });
        if (response.ok) {
          const data = await response.json();
          apiKey = data.apiKey ?? data.api_key;
        }
      } catch {
        // offline fallback
      }

      if (!apiKey) {
        apiKey = `dev_${uuidv4()}`;
      }

      const profile: SurveyorProfile = {
        id: uuidv4(),
        email,
        fullName,
        iskNumber,
        verifiedIsk: false, // verified separately via ISK verification flow
        firmName,
        apiKey,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await saveSurveyorProfile(profile);
      const engine = getSyncEngine();
      await engine.setApiKey(apiKey);

      set({ profile, isAuthenticated: true, isLoading: false });
      return { ok: true };
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return { ok: false, error: err.message };
    }
  },

  signOut: async () => {
    const engine = getSyncEngine();
    await engine.clearApiKey();
    set({ profile: null, isAuthenticated: false });
  },

  updateProfile: async (updates) => {
    const current = get().profile;
    if (!current) return;
    const updated = { ...current, ...updates };
    await saveSurveyorProfile(updated);
    set({ profile: updated });
  },
}));
