/**
 * GCP (Ground Control Point) + Drone mission database queries.
 *
 * GCPs are field-captured points with cm-level GNSS RTK accuracy, used by
 * the desktop's photogrammetry pipeline (WebODM / Pix4D) to georeference
 * drone imagery. Without accurate GCPs, drone surveys are only accurate
 * to the drone's GPS (1-3m horizontal, much worse vertical).
 *
 * Mobile's job: capture GCPs with high-accuracy positioning + photo evidence
 * Desktop's job: import GCPs into photogrammetry software, process imagery
 */

import { getDatabase, generateId, nowISO } from './schema';
import type { GCP, DroneMission, FlightPhoto, TargetType, SolutionType, DroneType, MissionStatus } from '@/types';

// ============================================================================
// GCP CRUD
// ============================================================================
export async function createGCP(input: {
  projectId: string;
  gcpId: string;
  easting: number;
  northing: number;
  elevation: number;
  lat?: number;
  lng?: number;
  height?: number;
  accuracyMm?: number;
  solutionType?: SolutionType;
  numSatellites?: number;
  photoUri?: string;
  targetType?: TargetType;
  targetSizeM?: number;
  notes?: string;
}): Promise<GCP> {
  const db = await getDatabase();
  const id = generateId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO gcps (
      id, project_id, gcp_id, easting, northing, elevation,
      lat, lng, height, accuracy_mm, solution_type, num_satellites,
      photo_uri, target_type, target_size_m, captured_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.projectId, input.gcpId, input.easting, input.northing, input.elevation,
      input.lat ?? null, input.lng ?? null, input.height ?? null,
      input.accuracyMm ?? null, input.solutionType ?? null, input.numSatellites ?? null,
      input.photoUri ?? null, input.targetType ?? null, input.targetSizeM ?? null,
      now, input.notes ?? null,
    ]
  );
  return {
    id, projectId: input.projectId, gcpId: input.gcpId,
    easting: input.easting, northing: input.northing, elevation: input.elevation,
    lat: input.lat, lng: input.lng, height: input.height,
    accuracyMm: input.accuracyMm, solutionType: input.solutionType,
    numSatellites: input.numSatellites,
    photoUri: input.photoUri, targetType: input.targetType,
    targetSizeM: input.targetSizeM, capturedAt: now, notes: input.notes,
  };
}

export async function getGCPs(projectId: string): Promise<GCP[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM gcps WHERE project_id = ? ORDER BY gcp_id ASC`,
    [projectId]
  );
  return rows.map(rowToGCP);
}

export async function deleteGCP(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM gcps WHERE id = ?`, [id]);
}

export async function updateGCP(id: string, updates: Partial<GCP>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];
  const map: Record<string, string> = {
    accuracyMm: 'accuracy_mm',
    solutionType: 'solution_type',
    numSatellites: 'num_satellites',
    photoUri: 'photo_uri',
    targetType: 'target_type',
    targetSizeM: 'target_size_m',
    notes: 'notes',
  };
  for (const [k, v] of Object.entries(updates)) {
    if (map[k]) {
      fields.push(`${map[k]} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE gcps SET ${fields.join(', ')} WHERE id = ?`, values);
}

// ============================================================================
// Drone Mission CRUD
// ============================================================================
export async function createMission(input: {
  projectId: string;
  name: string;
  droneType?: DroneType;
  plannedAltitudeM?: number;
  plannedSpeedMs?: number;
  overlapFrontal?: number;
  overlapSide?: number;
  notes?: string;
}): Promise<DroneMission> {
  const db = await getDatabase();
  const id = generateId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO drone_missions (
      id, project_id, name, drone_type, planned_altitude_m, planned_speed_ms,
      overlap_frontal, overlap_side, photo_count, status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'planned', ?, ?)`,
    [
      id, input.projectId, input.name, input.droneType ?? null,
      input.plannedAltitudeM ?? null, input.plannedSpeedMs ?? null,
      input.overlapFrontal ?? null, input.overlapSide ?? null,
      input.notes ?? null, now,
    ]
  );
  return {
    id, projectId: input.projectId, name: input.name,
    droneType: input.droneType,
    plannedAltitudeM: input.plannedAltitudeM,
    plannedSpeedMs: input.plannedSpeedMs,
    overlapFrontal: input.overlapFrontal,
    overlapSide: input.overlapSide,
    photoCount: 0, status: 'planned', notes: input.notes, createdAt: now,
  };
}

export async function getMissions(projectId: string): Promise<DroneMission[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM drone_missions WHERE project_id = ? ORDER BY created_at DESC`,
    [projectId]
  );
  return rows.map(rowToMission);
}

export async function updateMissionStatus(id: string, status: MissionStatus, photoCount?: number): Promise<void> {
  const db = await getDatabase();
  if (photoCount !== undefined) {
    await db.runAsync(
      `UPDATE drone_missions SET status = ?, photo_count = ? WHERE id = ?`,
      [status, photoCount, id]
    );
  } else {
    await db.runAsync(`UPDATE drone_missions SET status = ? WHERE id = ?`, [status, id]);
  }
}

export async function deleteMission(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM drone_missions WHERE id = ?`, [id]);
}

// ============================================================================
// Flight Photo CRUD
// ============================================================================
export async function addFlightPhoto(input: {
  missionId: string;
  photoUri: string;
  capturedAt: string;
  lat?: number;
  lng?: number;
  altitudeM?: number;
  yawDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO flight_photos (
      id, mission_id, photo_uri, captured_at, lat, lng, altitude_m, yaw_deg, pitch_deg, roll_deg
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(), input.missionId, input.photoUri, input.capturedAt,
      input.lat ?? null, input.lng ?? null, input.altitudeM ?? null,
      input.yawDeg ?? null, input.pitchDeg ?? null, input.rollDeg ?? null,
    ]
  );
  // Update mission photo count
  await db.runAsync(
    `UPDATE drone_missions SET photo_count = photo_count + 1 WHERE id = ?`,
    [input.missionId]
  );
}

export async function getFlightPhotos(missionId: string): Promise<FlightPhoto[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM flight_photos WHERE mission_id = ? ORDER BY captured_at ASC`,
    [missionId]
  );
  return rows.map(rowToPhoto);
}

// ============================================================================
// Row mappers
// ============================================================================
function rowToGCP(r: any): GCP {
  return {
    id: r.id, projectId: r.project_id, gcpId: r.gcp_id,
    easting: r.easting, northing: r.northing, elevation: r.elevation,
    lat: r.lat ?? undefined, lng: r.lng ?? undefined, height: r.height ?? undefined,
    accuracyMm: r.accuracy_mm ?? undefined,
    solutionType: r.solution_type ?? undefined,
    numSatellites: r.num_satellites ?? undefined,
    photoUri: r.photo_uri ?? undefined,
    targetType: r.target_type ?? undefined,
    targetSizeM: r.target_size_m ?? undefined,
    capturedAt: r.captured_at,
    notes: r.notes ?? undefined,
  };
}

function rowToMission(r: any): DroneMission {
  return {
    id: r.id, projectId: r.project_id, name: r.name,
    droneType: r.drone_type ?? undefined,
    plannedAltitudeM: r.planned_altitude_m ?? undefined,
    plannedSpeedMs: r.planned_speed_ms ?? undefined,
    overlapFrontal: r.overlap_frontal ?? undefined,
    overlapSide: r.overlap_side ?? undefined,
    areaCoveredSqm: r.area_covered_sqm ?? undefined,
    photoCount: r.photo_count,
    flightStart: r.flight_start ?? undefined,
    flightEnd: r.flight_end ?? undefined,
    status: r.status,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

function rowToPhoto(r: any): FlightPhoto {
  return {
    id: r.id, missionId: r.mission_id, photoUri: r.photo_uri,
    capturedAt: r.captured_at,
    lat: r.lat ?? undefined, lng: r.lng ?? undefined,
    altitudeM: r.altitude_m ?? undefined,
    yawDeg: r.yaw_deg ?? undefined,
    pitchDeg: r.pitch_deg ?? undefined,
    rollDeg: r.roll_deg ?? undefined,
  };
}

// ============================================================================
// Constants for UI
// ============================================================================
export const TARGET_TYPES: { value: TargetType; label: string; icon: string }[] = [
  { value: 'checkerboard', label: 'Checkerboard', icon: 'checkerboard' },
  { value: 'cross', label: 'Cross', icon: 'plus-box-outline' },
  { value: 'natural', label: 'Natural Feature', icon: 'map-marker' },
];

export const DRONE_TYPES: { value: DroneType; label: string; icon: string }[] = [
  { value: 'dji_phantom', label: 'DJI Phantom', icon: 'quadcopter' },
  { value: 'dji_mavic', label: 'DJI Mavic', icon: 'quadcopter' },
  { value: 'parrot', label: 'Parrot', icon: 'quadcopter' },
  { value: 'fixed_wing', label: 'Fixed Wing', icon: 'airplane' },
  { value: 'other', label: 'Other', icon: 'drone' },
];

export const SOLUTION_TYPES: { value: SolutionType; label: string; color: string }[] = [
  { value: 'fixed', label: 'RTK Fixed', color: '#10B981' },
  { value: 'float', label: 'RTK Float', color: '#F59E0B' },
  { value: 'dgps', label: 'DGPS', color: '#3B82F6' },
  { value: 'single', label: 'Single', color: '#EF4444' },
];
