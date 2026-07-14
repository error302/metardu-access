/**
 * Beacon database queries — catalog of beacons with photos and conditions.
 */

import { getDatabase, generateId, nowISO } from './schema';
import type { ParcelPoint } from '@/types';

export interface Beacon {
  id: string;
  projectId: string;
  pointNumber: string;
  beaconType: NonNullable<ParcelPoint['beaconType']>;
  condition: NonNullable<ParcelPoint['condition']>;
  photoUri?: string;
  description?: string;
  easting?: number;
  northing?: number;
  elevation?: number;
  createdAt: string;
}

export async function createBeacon(input: {
  projectId: string;
  pointNumber: string;
  beaconType?: NonNullable<ParcelPoint['beaconType']>;
  condition?: NonNullable<ParcelPoint['condition']>;
  photoUri?: string;
  description?: string;
  easting?: number;
  northing?: number;
  elevation?: number;
}): Promise<Beacon> {
  const db = await getDatabase();
  const id = generateId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO beacons (id, project_id, point_number, beacon_type, condition, photo_uri, description)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.pointNumber,
      input.beaconType ?? 'concrete',
      input.condition ?? 'good',
      input.photoUri ?? null,
      input.description ?? null,
    ]
  );
  return {
    id,
    projectId: input.projectId,
    pointNumber: input.pointNumber,
    beaconType: input.beaconType ?? 'concrete',
    condition: input.condition ?? 'good',
    photoUri: input.photoUri,
    description: input.description,
    easting: input.easting,
    northing: input.northing,
    elevation: input.elevation,
    createdAt: now,
  };
}

export async function getBeacons(projectId: string): Promise<Beacon[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM beacons WHERE project_id = ? ORDER BY point_number ASC`,
    [projectId]
  );
  return rows.map(rowToBeacon);
}

export async function deleteBeacon(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM beacons WHERE id = ?`, [id]);
}

function rowToBeacon(r: any): Beacon {
  return {
    id: r.id,
    projectId: r.project_id,
    pointNumber: r.point_number,
    beaconType: r.beacon_type,
    condition: r.condition,
    photoUri: r.photo_uri ?? undefined,
    description: r.description ?? undefined,
    createdAt: r.created_at,
  };
}

export const BEACON_TYPES: { value: NonNullable<ParcelPoint['beaconType']>; label: string; icon: string }[] = [
  { value: 'concrete', label: 'Concrete', icon: 'cube-outline' },
  { value: 'iron_pin', label: 'Iron Pin', icon: 'nail' },
  { value: 'stone', label: 'Stone', icon: 'gem-outline' },
  { value: 'natural', label: 'Natural Feature', icon: 'tree' },
];

export const BEACON_CONDITIONS: { value: NonNullable<ParcelPoint['condition']>; label: string; color: string }[] = [
  { value: 'good', label: 'Good', color: '#10B981' },
  { value: 'disturbed', label: 'Disturbed', color: '#F59E0B' },
  { value: 'destroyed', label: 'Destroyed', color: '#EF4444' },
  { value: 'missing', label: 'Missing', color: '#6B7280' },
];
