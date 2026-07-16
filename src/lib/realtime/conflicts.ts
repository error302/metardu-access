/**
 * Conflict resolution — detect and resolve sync divergences.
 *
 * Conflict scenarios:
 *   1. Two surveyors edit the same point simultaneously
 *   2. Surveyor edits offline; office edits the same point; sync happens
 *   3. Same session pushed from two devices
 *
 * Resolution strategies:
 *   - "last-write-wins" (default, simple) — newer timestamp wins
 *   - "field-merge" — merge non-overlapping field changes
 *   - "manual" — show diff to user, let them choose
 *
 * For Metardu Access, most data is immutable (captured points are never edited),
 * so conflicts are rare. The main risk is at the project metadata level
 * (name, status, surveyor assignment).
 */

import type { FieldSession, Project } from '@/types';

export interface ConflictRecord {
  id: string;
  type: 'project' | 'session' | 'point' | 'observation';
  entityId: string;
  field: string;
  clientValue: any;
  serverValue: any;
  clientTimestamp: string;
  serverTimestamp: string;
  resolution: 'pending' | 'client-wins' | 'server-wins' | 'merged' | 'manual';
  resolvedValue?: any;
  detectedAt: string;
}

export interface DiffEntry {
  field: string;
  clientValue: any;
  serverValue: any;
  winner: 'client' | 'server' | 'tie';
}

/**
 * Compare two objects field-by-field and produce a diff.
 */
export function diffObjects(
  client: Record<string, any>,
  server: Record<string, any>,
  ignoreFields: string[] = ['updatedAt', 'syncedAt', 'syncStatus']
): DiffEntry[] {
  const allFields = new Set([
    ...Object.keys(client),
    ...Object.keys(server),
  ].filter((f) => !ignoreFields.includes(f)));

  const diffs: DiffEntry[] = [];
  for (const field of allFields) {
    const cv = client[field];
    const sv = server[field];
    if (JSON.stringify(cv) !== JSON.stringify(sv)) {
      // Determine winner by timestamp (if available)
      const clientTs = client.updatedAt ?? client.timestamp ?? '';
      const serverTs = server.updatedAt ?? server.timestamp ?? '';
      const winner: DiffEntry['winner'] =
        clientTs > serverTs ? 'client' :
        serverTs > clientTs ? 'server' :
        'tie';
      diffs.push({ field, clientValue: cv, serverValue: sv, winner });
    }
  }
  return diffs;
}

/**
 * Apply last-write-wins resolution.
 * Returns the merged object.
 */
export function lastWriteWins(
  client: Record<string, any>,
  server: Record<string, any>
): Record<string, any> {
  const clientTs = new Date(client.updatedAt ?? client.timestamp ?? 0).getTime();
  const serverTs = new Date(server.updatedAt ?? server.timestamp ?? 0).getTime();
  return clientTs >= serverTs ? client : server;
}

/**
 * Apply field-level merge — for each field, take the value from the
 * version that was updated most recently.
 */
export function fieldLevelMerge(
  client: Record<string, any>,
  server: Record<string, any>
): Record<string, any> {
  const merged: Record<string, any> = { ...server };
  const diffs = diffObjects(client, server);
  for (const diff of diffs) {
    if (diff.winner === 'client') {
      merged[diff.field] = diff.clientValue;
    } else if (diff.winner === 'server') {
      merged[diff.field] = diff.serverValue;
    } else {
      // Tie — prefer client (surveyor's version, since they're in the field)
      merged[diff.field] = diff.clientValue;
    }
  }
  merged.updatedAt = new Date().toISOString();
  return merged;
}

/**
 * Detect conflicts between client and server versions of a project.
 */
export function detectProjectConflicts(
  client: Project,
  server: Project
): ConflictRecord[] {
  const diffs = diffObjects(client, server);
  return diffs.map((d) => ({
    id: `conflict-${client.id}-${d.field}-${Date.now()}`,
    type: 'project' as const,
    entityId: client.id,
    field: d.field,
    clientValue: d.clientValue,
    serverValue: d.serverValue,
    clientTimestamp: client.updatedAt,
    serverTimestamp: server.updatedAt,
    resolution: 'pending' as const,
    detectedAt: new Date().toISOString(),
  }));
}

/**
 * Detect conflicts between client and server versions of a field session.
 */
export function detectSessionConflicts(
  client: FieldSession,
  server: FieldSession
): ConflictRecord[] {
  const diffs = diffObjects(client, server);
  return diffs.map((d) => ({
    id: `conflict-${client.sessionId}-${d.field}-${Date.now()}`,
    type: 'session' as const,
    entityId: client.sessionId,
    field: d.field,
    clientValue: d.clientValue,
    serverValue: d.serverValue,
    clientTimestamp: client.startDate,
    serverTimestamp: server.syncedAt ?? server.startDate,
    resolution: 'pending' as const,
    detectedAt: new Date().toISOString(),
  }));
}

/**
 * Format a conflict for human-readable display.
 */
export function formatConflict(conflict: ConflictRecord): {
  title: string;
  description: string;
  recommendation: 'client' | 'server' | 'manual';
} {
  const entityLabel =
    conflict.type === 'project' ? 'Project' :
    conflict.type === 'session' ? 'Field Session' :
    conflict.type === 'point' ? 'Survey Point' :
    'Observation';

  const title = `${entityLabel} conflict: ${conflict.field}`;

  const clientStr = typeof conflict.clientValue === 'object'
    ? JSON.stringify(conflict.clientValue)
    : String(conflict.clientValue);
  const serverStr = typeof conflict.serverValue === 'object'
    ? JSON.stringify(conflict.serverValue)
    : String(conflict.serverValue);

  const description =
    `Field: ${conflict.field}\n` +
    `Your version:   ${clientStr.slice(0, 100)}\n` +
    `Server version: ${serverStr.slice(0, 100)}\n` +
    `Your time:   ${conflict.clientTimestamp}\n` +
    `Server time: ${conflict.serverTimestamp}`;

  // Recommend based on timestamp
  const clientTs = new Date(conflict.clientTimestamp).getTime();
  const serverTs = new Date(conflict.serverTimestamp).getTime();
  const recommendation =
    clientTs > serverTs ? 'client' :
    serverTs > clientTs ? 'server' :
    'manual';

  return { title, description, recommendation };
}
