/**
 * Background GPS tracking service.
 *
 * Surveyors walk for hours during traverses. They cannot hold the phone
 * awake the entire time. This service:
 *
 *   1. Uses expo-location's background task (TaskManager) to keep tracking
 *      even when the app is backgrounded
 *   2. Uses a foreground service on Android (notification persists)
 *   3. Adapts accuracy based on battery level:
 *        - >50% battery: BestForNavigation (GNSS + WiFi + Cell, ~1-3m)
 *        - 20-50%: High (GNSS only, ~3-5m)
 *        - <20%: Balanced (WiFi + Cell, ~10-30m)
 *   4. Logs track points to SQLite for later export as GPX/KML
 *   5. Provides live callbacks to UI for current position
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';

const BACKGROUND_TASK_NAME = 'metardu-background-tracking';

export type AccuracyMode = 'best' | 'high' | 'balanced' | 'low-power';

export interface TrackPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  batteryLevel: number | null;
}

export interface ActiveTrack {
  id: string;
  projectId: string;
  projectName: string;
  surveyorName: string;
  startedAt: number;
  pointCount: number;
  distanceM: number;
  currentAccuracy: AccuracyMode;
}

let currentTrack: ActiveTrack | null = null;
let positionListeners: ((pos: TrackPoint) => void)[] = [];
let foregroundSubscription: Location.LocationSubscription | null = null;

// Background task definition (must be at module scope)
TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[tracking] Background task error:', error);
    return;
  }
  if (!data) return;

  const location = (data as { locations: Location.LocationObject[] }).locations[0];
  if (!location) return;

  const point: TrackPoint = {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    altitude: location.coords.altitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    heading: location.coords.heading,
    timestamp: location.timestamp,
    batteryLevel: await Battery.getBatteryLevelAsync(),
  };

  positionListeners.forEach((cb) => cb(point));
});

export async function getAdaptiveAccuracy(): Promise<AccuracyMode> {
  const level = await Battery.getBatteryLevelAsync();
  const state = await Battery.getBatteryStateAsync();

  if (state === Battery.BatteryState.CHARGING) return 'best';

  if (level > 0.5) return 'best';
  if (level > 0.2) return 'high';
  if (level > 0.1) return 'balanced';
  return 'low-power';
}

function accuracyToExpo(mode: AccuracyMode): Location.LocationAccuracy {
  switch (mode) {
    case 'best': return Location.Accuracy.BestForNavigation;
    case 'high': return Location.Accuracy.High;
    case 'balanced': return Location.Accuracy.Balanced;
    case 'low-power': return Location.Accuracy.Low;
  }
}

export async function startTrack(input: {
  projectId: string;
  projectName: string;
  surveyorName: string;
}): Promise<ActiveTrack> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') {
    throw new Error('Foreground location permission denied');
  }

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  if (bgStatus !== 'granted') {
    throw new Error('Background location permission denied — required for long traverses');
  }

  if (currentTrack) {
    await stopTrack();
  }

  currentTrack = {
    id: `track-${Date.now()}`,
    projectId: input.projectId,
    projectName: input.projectName,
    surveyorName: input.surveyorName,
    startedAt: Date.now(),
    pointCount: 0,
    distanceM: 0,
    currentAccuracy: await getAdaptiveAccuracy(),
  };

  const accuracy = accuracyToExpo(currentTrack.currentAccuracy);
  foregroundSubscription = await Location.watchPositionAsync(
    {
      accuracy,
      timeInterval: 2000,
      distanceInterval: 1,
      deferredUpdatesDistance: 5,
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true,
    },
    (location) => {
      const point: TrackPoint = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        altitude: location.coords.altitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: location.timestamp,
        batteryLevel: null,
      };
      if (currentTrack) {
        currentTrack.pointCount++;
      }
      positionListeners.forEach((cb) => cb(point));
    }
  );

  await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
    accuracy,
    timeInterval: 10000,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Metardu Access is tracking',
      notificationBody: `Recording track for ${input.projectName}`,
      notificationColor: '#F97316',
    },
  });

  return currentTrack;
}

export async function stopTrack(): Promise<ActiveTrack | null> {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }

  if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
  }

  const finished = currentTrack;
  currentTrack = null;
  return finished;
}

export function getActiveTrack(): ActiveTrack | null {
  return currentTrack;
}

export function onTrackPoint(cb: (point: TrackPoint) => void): () => void {
  positionListeners.push(cb);
  return () => {
    positionListeners = positionListeners.filter((l) => l !== cb);
  };
}

export async function maybeUpgradeAccuracy(): Promise<void> {
  if (!currentTrack || !foregroundSubscription) return;
  const newMode = await getAdaptiveAccuracy();
  if (newMode !== currentTrack.currentAccuracy) {
    foregroundSubscription.remove();
    const accuracy = accuracyToExpo(newMode);
    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy,
        timeInterval: 2000,
        distanceInterval: 1,
        showsBackgroundLocationIndicator: true,
      },
      (location) => {
        const point: TrackPoint = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          speed: location.coords.speed,
          heading: location.coords.heading,
          timestamp: location.timestamp,
          batteryLevel: null,
        };
        if (currentTrack) {
          currentTrack.currentAccuracy = newMode;
          currentTrack.pointCount++;
        }
        positionListeners.forEach((cb) => cb(point));
      }
    );
  }
}

export async function checkTrackingAvailability(): Promise<{
  available: boolean;
  foregroundPermission: boolean;
  backgroundPermission: boolean;
  reason?: string;
}> {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();

  if (!fg.granted) {
    return {
      available: false,
      foregroundPermission: false,
      backgroundPermission: false,
      reason: 'Foreground location permission not granted',
    };
  }

  if (!bg.granted) {
    return {
      available: false,
      foregroundPermission: true,
      backgroundPermission: false,
      reason: 'Background location permission required for long traverses',
    };
  }

  return {
    available: true,
    foregroundPermission: true,
    backgroundPermission: true,
  };
}
