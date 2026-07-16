/**
 * Sync queue with exponential backoff + jitter.
 *
 * Rural Kenya connectivity is spotty. Sessions need to retry with:
 *   - Exponential backoff: 1s → 2s → 4s → 8s → 16s → 32s → 60s (capped)
 *   - Jitter: random ±25% to avoid thundering herd on server
 *   - Max attempts: 10 before giving up (user can manually retry)
 *   - Network-aware: only attempts when network is up
 *
 * Also supports real-time WebSocket sync for live collaboration (separate path).
 */

import * as Network from 'expo-network';
import { getSyncQueue, markSynced, markSyncFailed } from '@/lib/db/queries';
import { getSyncEngine } from '@/lib/sync/engine';
import type { SyncQueueItem } from '@/types';

const MAX_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 60_000; // 1 minute cap
const JITTER_FACTOR = 0.25;

/**
 * Compute the next retry delay using exponential backoff + jitter.
 * attempt=0 → ~1s, attempt=1 → ~2s, attempt=2 → ~4s, ... capped at 60s.
 */
export function computeBackoff(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = exponential * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.max(100, exponential + jitter);
}

/**
 * Check if the queue should attempt sync now.
 * Returns true if network is up and at least one item is due.
 */
export async function shouldAttemptSync(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || !state.isInternetReachable) return false;

  const queue = await getSyncQueue();
  if (queue.length === 0) return false;

  // Check if any item is due for retry
  const now = Date.now();
  const dueItem = queue.find((item) => {
    if (item.attempts >= MAX_ATTEMPTS) return false;
    if (!item.lastAttemptAt) return true; // never tried
    const lastAttempt = new Date(item.lastAttemptAt).getTime();
    const delay = computeBackoff(item.attempts);
    return now - lastAttempt >= delay;
  });

  return Boolean(dueItem);
}

/**
 * Drain the queue — attempt to push all due items.
 * Called by:
 *   - Manual "Sync Now" button (immediate, ignores backoff)
 *   - Background task (every 15 min, respects backoff)
 *   - Network reconnect event (respects backoff)
 */
export async function drainQueue(
  onProgress?: (item: SyncQueueItem, ok: boolean, error?: string) => void
): Promise<{ pushed: number; failed: number; deferred: number }> {
  const engine = getSyncEngine();
  const queue = await getSyncQueue();
  const now = Date.now();

  let pushed = 0;
  let failed = 0;
  let deferred = 0;

  for (const item of queue) {
    // Skip if max attempts exceeded
    if (item.attempts >= MAX_ATTEMPTS) {
      failed++;
      onProgress?.(item, false, 'Max attempts exceeded');
      continue;
    }

    // Check backoff window (unless forced)
    if (item.lastAttemptAt) {
      const lastAttempt = new Date(item.lastAttemptAt).getTime();
      const delay = computeBackoff(item.attempts);
      if (now - lastAttempt < delay) {
        deferred++;
        continue;
      }
    }

    // Attempt push
    const result = await engine.pushSession(item.payload);
    if (result.ok) {
      pushed++;
      onProgress?.(item, true);
    } else {
      failed++;
      onProgress?.(item, false, result.error);
    }
  }

  return { pushed, failed, deferred };
}

/**
 * Force drain — ignores backoff, used by manual "Sync Now" button.
 */
export async function forceDrainQueue(
  onProgress?: (item: SyncQueueItem, ok: boolean, error?: string) => void
): Promise<{ pushed: number; failed: number }> {
  const engine = getSyncEngine();
  const queue = await getSyncQueue();

  let pushed = 0;
  let failed = 0;

  for (const item of queue) {
    const result = await engine.pushSession(item.payload);
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

/**
 * Get queue stats for UI.
 */
export async function getQueueStats(): Promise<{
  total: number;
  due: number;
  failed: number;
  nextRetryIn?: number; // ms until next retry
}> {
  const queue = await getSyncQueue();
  const now = Date.now();

  let due = 0;
  let failed = 0;
  let nextRetryIn: number | undefined;

  for (const item of queue) {
    if (item.attempts >= MAX_ATTEMPTS) {
      failed++;
      continue;
    }
    if (!item.lastAttemptAt) {
      due++;
      nextRetryIn = 0;
    } else {
      const lastAttempt = new Date(item.lastAttemptAt).getTime();
      const delay = computeBackoff(item.attempts);
      const waitMs = delay - (now - lastAttempt);
      if (waitMs <= 0) {
        due++;
        nextRetryIn = 0;
      } else if (nextRetryIn === undefined || waitMs < nextRetryIn) {
        nextRetryIn = waitMs;
      }
    }
  }

  return {
    total: queue.length,
    due,
    failed,
    nextRetryIn,
  };
}

/**
 * Format a backoff delay for display.
 */
export function formatDelay(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
