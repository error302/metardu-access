/**
 * Settings store — outdoor mode, language, contrast, units.
 */

import { create } from 'zustand';
import * as AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'en' | 'sw';
export type DistanceUnit = 'metric' | 'imperial';
export type AngleUnit = 'degrees' | 'gons';

interface SettingsState {
  outdoorMode: boolean;
  highContrast: boolean;
  locale: Locale;
  distanceUnit: DistanceUnit;
  angleUnit: AngleUnit;
  autoSync: boolean;
  mapTileCache: boolean;

  toggleOutdoorMode: () => void;
  toggleHighContrast: () => void;
  setLocale: (l: Locale) => void;
  setDistanceUnit: (u: DistanceUnit) => void;
  setAngleUnit: (u: AngleUnit) => void;
  toggleAutoSync: () => void;
  toggleMapTileCache: () => void;
  load: () => Promise<void>;
}

const STORAGE_KEY = 'metardu_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  outdoorMode: false,
  highContrast: false,
  locale: (process.env.EXPO_PUBLIC_DEFAULT_LOCALE as Locale) || 'en',
  distanceUnit: 'metric',
  angleUnit: 'degrees',
  autoSync: true,
  mapTileCache: true,

  toggleOutdoorMode: () => {
    set({ outdoorMode: !get().outdoorMode });
    void persist(get());
  },
  toggleHighContrast: () => {
    set({ highContrast: !get().highContrast });
    void persist(get());
  },
  setLocale: (l) => {
    set({ locale: l });
    void persist(get());
  },
  setDistanceUnit: (u) => {
    set({ distanceUnit: u });
    void persist(get());
  },
  setAngleUnit: (u) => {
    set({ angleUnit: u });
    void persist(get());
  },
  toggleAutoSync: () => {
    set({ autoSync: !get().autoSync });
    void persist(get());
  },
  toggleMapTileCache: () => {
    set({ mapTileCache: !get().mapTileCache });
    void persist(get());
  },

  load: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        set(saved);
      } catch {
        // ignore parse errors
      }
    }
  },
}));

async function persist(state: SettingsState) {
  const toSave = {
    outdoorMode: state.outdoorMode,
    highContrast: state.highContrast,
    locale: state.locale,
    distanceUnit: state.distanceUnit,
    angleUnit: state.angleUnit,
    autoSync: state.autoSync,
    mapTileCache: state.mapTileCache,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}
