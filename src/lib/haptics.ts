/**
 * Haptics utility — central place for all tactile feedback.
 *
 * Critical for field use: surveyors wearing gloves can't always see the screen
 * react to taps. Haptic feedback confirms the action was registered.
 *
 * Patterns are tuned for different action severities:
 *   - light: button taps, list item selection
 *   - medium: form submission, navigation
 *   - heavy: point captured, measurement saved, session sealed
 *   - success/error/warning: outcome notification
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettingsStore } from '@/stores/settingsStore';

// Check if haptics are enabled (could add a setting later)
function hapticsEnabled(): boolean {
  // Always enabled on iOS; on Android only when haptic setting is on
  if (Platform.OS === 'ios') return true;
  return true; // Default on — could be made configurable
}

export async function light(): Promise<void> {
  if (!hapticsEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

export async function medium(): Promise<void> {
  if (!hapticsEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {}
}

export async function heavy(): Promise<void> {
  if (!hapticsEnabled()) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {}
}

export async function success(): Promise<void> {
  if (!hapticsEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

export async function error(): Promise<void> {
  if (!hapticsEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}

export async function warning(): Promise<void> {
  if (!hapticsEnabled()) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

export async function selection(): Promise<void> {
  if (!hapticsEnabled()) return;
  try {
    await Haptics.selectionAsync();
  } catch {}
}

// Convenience bundles for common field actions
export const field = {
  /** When a point is captured (GPS or total station) */
  pointCaptured: heavy,
  /** When an observation is saved */
  observationSaved: medium,
  /** When a session is sealed */
  sessionSealed: success,
  /** When sync completes */
  syncComplete: success,
  /** When sync fails */
  syncFailed: error,
  /** When a beacon is added */
  beaconAdded: medium,
  /** When a breakline vertex is captured */
  vertexCaptured: light,
  /** When a button is tapped (use in Button component) */
  tap: light,
  /** When a tab is switched */
  tabSwitch: selection,
};
