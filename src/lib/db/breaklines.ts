/**
 * Breakline database queries — create, list, add points, compute length.
 *
 * Breaklines are field-captured sequences of points that constrain the TIN
 * surface generated later on the desktop. Without breaklines, the desktop's
 * TIN interpolates across valleys and ridges incorrectly.
 *
 * Types:
 *   - 'hard'     : man-made (road edge, wall, building footing) — TIN edges follow exactly
 *   - 'soft'     : natural (ridge, valley, water course) — TIN edges follow approximately
 *   - 'boundary' : outer boundary of survey area (defines TIN clipping region)
 */

import { getDatabase, generateId, nowISO } from './schema';
import { computeBearingDistance } from '@engine/traverse';
import type { Breakline, BreaklinePoint, BreaklineWithPoints, BreaklineType } from '@/types';

// ============================================================================
// Breakline CRUD
// ============================================================================
export async function createBreakline(input: {
  projectId: string;
  name: string;
  type?: BreaklineType;
  layer?: string;
  notes?: string;
}): Promise<Breakline> {
  const db = await getDatabase();
  const id = generateId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO breaklines (id, project_id, name, type, layer, point_count, length_m, captured_at, notes)
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [
      id,
      input.projectId,
      input.name,
      input.type ?? 'soft',
      input.layer ?? null,
      now,
      input.notes ?? null,
    ]
  );
  return {
    id,
    projectId: input.projectId,
    name: input.name,
    type: input.type ?? 'soft',
    layer: input.layer,
    pointCount: 0,
    lengthM: 0,
    capturedAt: now,
    notes: input.notes,
  };
}

export async function getBreaklines(projectId: string): Promise<Breakline[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM breaklines WHERE project_id = ? ORDER BY captured_at DESC`,
    [projectId]
  );
  return rows.map(rowToBreakline);
}

export async function getBreakline(id: string): Promise<BreaklineWithPoints | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(`SELECT * FROM breaklines WHERE id = ?`, [id]);
  if (!row) return null;
  const breakline = rowToBreakline(row);
  const pointRows = await db.getAllAsync<any>(
    `SELECT * FROM breakline_points WHERE breakline_id = ? ORDER BY seq ASC`,
    [id]
  );
  return {
    ...breakline,
    points: pointRows.map(rowToBreaklinePoint),
  };
}

export async function deleteBreakline(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM breaklines WHERE id = ?`, [id]);
}

// ============================================================================
// Breakline points
// ============================================================================
export async function addBreaklinePoint(input: {
  breaklineId: string;
  pointNumber: string;
  easting?: number;
  northing?: number;
  elevation?: number;
}): Promise<void> {
  const db = await getDatabase();
  // Determine next sequence number
  const seqRow = await db.getFirstAsync<{ max_seq: number }>(
    `SELECT COALESCE(MAX(seq), -1) as max_seq FROM breakline_points WHERE breakline_id = ?`,
    [input.breaklineId]
  );
  const seq = (seqRow?.max_seq ?? -1) + 1;

  await db.runAsync(
    `INSERT INTO breakline_points (id, breakline_id, seq, point_number, easting, northing, elevation, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      input.breaklineId,
      seq,
      input.pointNumber,
      input.easting ?? null,
      input.northing ?? null,
      input.elevation ?? null,
      nowISO(),
    ]
  );
  await recomputeBreakline(input.breaklineId);
}

export async function removeBreaklinePoint(breaklineId: string, seq: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM breakline_points WHERE breakline_id = ? AND seq = ?`,
    [breaklineId, seq]
  );
  // Resequence remaining points
  const remaining = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM breakline_points WHERE breakline_id = ? ORDER BY seq ASC`,
    [breaklineId]
  );
  for (let i = 0; i < remaining.length; i++) {
    await db.runAsync(`UPDATE breakline_points SET seq = ? WHERE id = ?`, [i, remaining[i].id]);
  }
  await recomputeBreakline(breaklineId);
}

/**
 * Recompute breakline length and point count.
 * Length is the sum of straight-line distances between consecutive points.
 */
async function recomputeBreakline(breaklineId: string): Promise<void> {
  const db = await getDatabase();
  const pointRows = await db.getAllAsync<{ easting: number; northing: number }>(
    `SELECT easting, northing FROM breakline_points WHERE breakline_id = ? ORDER BY seq ASC`,
    [breaklineId]
  );

  let length = 0;
  for (let i = 1; i < pointRows.length; i++) {
    const prev = pointRows[i - 1];
    const curr = pointRows[i];
    if (prev.easting != null && prev.northing != null && curr.easting != null && curr.northing != null) {
      const { distance } = computeBearingDistance(
        prev.easting, prev.northing, curr.easting, curr.northing
      );
      length += distance;
    }
  }

  await db.runAsync(
    `UPDATE breaklines SET point_count = ?, length_m = ? WHERE id = ?`,
    [pointRows.length, length, breaklineId]
  );
}

// ============================================================================
// Row mappers
// ============================================================================
function rowToBreakline(r: any): Breakline {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    type: r.type,
    layer: r.layer ?? undefined,
    pointCount: r.point_count,
    lengthM: r.length_m,
    capturedAt: r.captured_at,
    notes: r.notes ?? undefined,
  };
}

function rowToBreaklinePoint(r: any): BreaklinePoint {
  return {
    id: r.id,
    breaklineId: r.breakline_id,
    seq: r.seq,
    pointNumber: r.point_number,
    easting: r.easting ?? undefined,
    northing: r.northing ?? undefined,
    elevation: r.elevation ?? undefined,
    capturedAt: r.captured_at,
  };
}

// ============================================================================
// Breakline type metadata (for UI)
// ============================================================================
export const BREAKLINE_TYPES: {
  value: BreaklineType;
  label: string;
  description: string;
  icon: string;
  color: string;
}[] = [
  {
    value: 'hard',
    label: 'Hard Breakline',
    description: 'Man-made — road edge, wall, building footing. TIN edges follow exactly.',
    icon: 'road-variant',
    color: '#EF4444',
  },
  {
    value: 'soft',
    label: 'Soft Breakline',
    description: 'Natural — ridge, valley, water course. TIN edges follow approximately.',
    icon: 'wave',
    color: '#10B981',
  },
  {
    value: 'boundary',
    label: 'Survey Boundary',
    description: 'Outer boundary of survey area. Defines TIN clipping region.',
    icon: 'vector-square',
    color: '#3B82F6',
  },
];
