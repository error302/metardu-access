/**
 * Parcel database queries — create, list, add points, compute area/perimeter.
 */

import { getDatabase, generateId, nowISO } from './schema';
import { polygonArea, polygonPerimeter, type Point2D } from '@engine/cogo';
import type { Parcel, ParcelPoint } from '@/types';

export async function createParcel(input: {
  projectId: string;
  parcelNumber: string;
  lrNumber?: string;
  registry?: string;
  traverseId?: string;
}): Promise<Parcel> {
  const db = await getDatabase();
  const id = generateId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO parcels (id, project_id, parcel_number, lr_number, registry, traverse_id, area_sqm, perimeter_m, status)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'draft')`,
    [
      id,
      input.projectId,
      input.parcelNumber,
      input.lrNumber ?? null,
      input.registry ?? null,
      input.traverseId ?? null,
    ]
  );
  return {
    id,
    projectId: input.projectId,
    parcelNumber: input.parcelNumber,
    lrNumber: input.lrNumber,
    registry: input.registry,
    areaSqm: 0,
    perimeterM: 0,
    traverseId: input.traverseId ?? '',
    status: 'draft',
    points: [],
  };
}

export async function getParcels(projectId: string): Promise<Parcel[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM parcels WHERE project_id = ? ORDER BY parcel_number ASC`,
    [projectId]
  );
  const parcels: Parcel[] = [];
  for (const row of rows) {
    const pointRows = await db.getAllAsync<any>(
      `SELECT * FROM parcel_points WHERE parcel_id = ? ORDER BY seq ASC`,
      [row.id]
    );
    parcels.push({
      id: row.id,
      projectId: row.project_id,
      parcelNumber: row.parcel_number,
      lrNumber: row.lr_number ?? undefined,
      registry: row.registry ?? undefined,
      areaSqm: row.area_sqm ?? 0,
      perimeterM: row.perimeter_m ?? 0,
      traverseId: row.traverse_id ?? '',
      status: row.status,
      points: pointRows.map(rowToParcelPoint),
    });
  }
  return parcels;
}

export async function getParcel(id: string): Promise<Parcel | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(`SELECT * FROM parcels WHERE id = ?`, [id]);
  if (!row) return null;
  const pointRows = await db.getAllAsync<any>(
    `SELECT * FROM parcel_points WHERE parcel_id = ? ORDER BY seq ASC`,
    [id]
  );
  return {
    id: row.id,
    projectId: row.project_id,
    parcelNumber: row.parcel_number,
    lrNumber: row.lr_number ?? undefined,
    registry: row.registry ?? undefined,
    areaSqm: row.area_sqm ?? 0,
    perimeterM: row.perimeter_m ?? 0,
    traverseId: row.traverse_id ?? '',
    status: row.status,
    points: pointRows.map(rowToParcelPoint),
  };
}

export async function addParcelPoint(
  parcelId: string,
  seq: number,
  pointNumber: string,
  isBeacon: boolean = true,
  beaconType?: ParcelPoint['beaconType'],
  condition?: ParcelPoint['condition']
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO parcel_points (id, parcel_id, seq, point_number, is_beacon, beacon_type, condition)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), parcelId, seq, pointNumber, isBeacon ? 1 : 0, beaconType ?? null, condition ?? null]
  );
  await recomputeParcel(parcelId);
}

export async function removeParcelPoint(parcelId: string, seq: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM parcel_points WHERE parcel_id = ? AND seq = ?`,
    [parcelId, seq]
  );
  // Resequence
  const remaining = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM parcel_points WHERE parcel_id = ? ORDER BY seq ASC`,
    [parcelId]
  );
  for (let i = 0; i < remaining.length; i++) {
    await db.runAsync(`UPDATE parcel_points SET seq = ? WHERE id = ?`, [i, remaining[i].id]);
  }
  await recomputeParcel(parcelId);
}

/**
 * Recompute area and perimeter from traverse station coordinates.
 * If no traverse linked, area/perimeter stays 0.
 */
async function recomputeParcel(parcelId: string): Promise<void> {
  const db = await getDatabase();
  const parcel = await getParcel(parcelId);
  if (!parcel) return;

  let area = 0;
  let perimeter = 0;

  if (parcel.traverseId && parcel.points.length >= 3) {
    // Fetch coordinates from traverse_stations
    const coords: Point2D[] = [];
    for (const p of parcel.points) {
      const row = await db.getFirstAsync<{ easting: number; northing: number }>(
        `SELECT easting, northing FROM traverse_stations
         WHERE traverse_id = ? AND point_number = ?`,
        [parcel.traverseId, p.pointNumber]
      );
      if (row) {
        coords.push({ easting: row.easting, northing: row.northing });
      }
    }
    if (coords.length >= 3) {
      area = polygonArea(coords);
      perimeter = polygonPerimeter(coords);
    }
  }

  await db.runAsync(
    `UPDATE parcels SET area_sqm = ?, perimeter_m = ? WHERE id = ?`,
    [area, perimeter, parcelId]
  );
}

export async function deleteParcel(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM parcels WHERE id = ?`, [id]);
}

function rowToParcelPoint(r: any): ParcelPoint {
  return {
    seq: r.seq,
    pointNumber: r.point_number,
    isBeacon: Boolean(r.is_beacon),
    beaconType: r.beacon_type ?? undefined,
    condition: r.condition ?? undefined,
  };
}
