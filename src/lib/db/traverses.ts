/**
 * Traverse database queries — create, list, get, add legs, compute adjustment.
 */

import { getDatabase, generateId, nowISO } from './schema';
import { bowditchAdjust, type TraverseLeg, type TraverseAdjustmentResult } from '@engine/traverse';
import type { Traverse, AdjustmentMethod } from '@/types';

export interface TraverseWithLegs extends Traverse {
  legs: TraverseLeg[];
  startEasting?: number;
  startNorthing?: number;
  closeEasting?: number;
  closeNorthing?: number;
}

export async function createTraverse(input: {
  projectId: string;
  sessionId?: string;
  name: string;
  surveyType: string;
  adjustmentMethod?: AdjustmentMethod;
  startPointNumber: string;
  closingPointNumber?: string;
  startEasting?: number;
  startNorthing?: number;
  closeEasting?: number;
  closeNorthing?: number;
}): Promise<Traverse> {
  const db = await getDatabase();
  const id = generateId();
  const now = nowISO();
  await db.runAsync(
    `INSERT INTO traverses (
      id, project_id, session_id, name, survey_type, adjustment_method,
      start_point_number, closing_point_number, perimeter, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?)`,
    [
      id,
      input.projectId,
      input.sessionId ?? null,
      input.name,
      input.surveyType,
      input.adjustmentMethod ?? 'bowditch',
      input.startPointNumber,
      input.closingPointNumber ?? null,
      now,
      now,
    ]
  );

  // Store start/close coordinates in metadata (use a settings approach via audit_log metadata)
  // For simplicity, we'll keep them in memory and on the traverse record via updateTraverse
  if (input.startEasting !== undefined && input.startNorthing !== undefined) {
    await db.runAsync(
      `INSERT INTO audit_log (id, timestamp, action, entity_id, entity_type, user_id, metadata)
       VALUES (?, ?, 'create_session', ?, 'traverse', 'local', ?)`,
      [
        generateId(),
        now,
        id,
        JSON.stringify({
          startEasting: input.startEasting,
          startNorthing: input.startNorthing,
          closeEasting: input.closeEasting,
          closeNorthing: input.closeNorthing,
          name: input.name,
        }),
      ]
    );
  }

  return {
    id,
    projectId: input.projectId,
    sessionId: input.sessionId,
    name: input.name,
    surveyType: input.surveyType as any,
    adjustmentMethod: input.adjustmentMethod ?? 'bowditch',
    startPointNumber: input.startPointNumber,
    closingPointNumber: input.closingPointNumber,
    perimeter: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

export async function getTraverses(projectId: string): Promise<Traverse[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM traverses WHERE project_id = ? ORDER BY updated_at DESC`,
    [projectId]
  );
  return rows.map(rowToTraverse);
}

export async function getTraverse(id: string): Promise<TraverseWithLegs | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(`SELECT * FROM traverses WHERE id = ?`, [id]);
  if (!row) return null;
  const traverse = rowToTraverse(row);

  // Fetch legs
  const legRows = await db.getAllAsync<any>(
    `SELECT * FROM traverse_legs WHERE traverse_id = ? ORDER BY seq ASC`,
    [id]
  );
  const legs: TraverseLeg[] = legRows.map((r) => ({
    fromPoint: r.from_point,
    toPoint: r.to_point,
    distance: r.distance,
    bearing: r.bearing,
  }));

  // Fetch start/close coords from audit_log metadata
  const metaRow = await db.getFirstAsync<any>(
    `SELECT metadata FROM audit_log WHERE entity_id = ? AND action = 'create_session' ORDER BY timestamp ASC LIMIT 1`,
    [id]
  );
  let startEasting, startNorthing, closeEasting, closeNorthing;
  if (metaRow?.metadata) {
    try {
      const meta = JSON.parse(metaRow.metadata);
      startEasting = meta.startEasting;
      startNorthing = meta.startNorthing;
      closeEasting = meta.closeEasting;
      closeNorthing = meta.closeNorthing;
    } catch {}
  }

  return {
    ...traverse,
    legs,
    startEasting,
    startNorthing,
    closeEasting,
    closeNorthing,
  };
}

export async function addTraverseLeg(
  traverseId: string,
  seq: number,
  leg: TraverseLeg
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO traverse_legs (id, traverse_id, seq, from_point, to_point, distance, bearing)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), traverseId, seq, leg.fromPoint, leg.toPoint, leg.distance, leg.bearing]
  );
  await recomputeTraverse(traverseId);
}

export async function deleteTraverseLeg(traverseId: string, seq: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM traverse_legs WHERE traverse_id = ? AND seq = ?`,
    [traverseId, seq]
  );
  // Resequence remaining legs
  const remaining = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM traverse_legs WHERE traverse_id = ? ORDER BY seq ASC`,
    [traverseId]
  );
  for (let i = 0; i < remaining.length; i++) {
    await db.runAsync(`UPDATE traverse_legs SET seq = ? WHERE id = ?`, [i, remaining[i].id]);
  }
  await recomputeTraverse(traverseId);
}

export async function recomputeTraverse(traverseId: string): Promise<void> {
  const traverse = await getTraverse(traverseId);
  if (!traverse) return;
  if (traverse.legs.length === 0) {
    await updateTraverseStats(traverseId, { perimeter: 0, status: 'draft' });
    return;
  }

  const startCoords = traverse.startEasting !== undefined
    ? { easting: traverse.startEasting, northing: traverse.startNorthing! }
    : { easting: 0, northing: 0 };
  const closingCoords = traverse.closeEasting !== undefined
    ? { easting: traverse.closeEasting, northing: traverse.closeNorthing! }
    : undefined;

  const result = bowditchAdjust(traverse.legs, startCoords, closingCoords);

  await updateTraverseStats(traverseId, {
    perimeter: result.perimeter,
    linearMisclosure: result.linearMisclosure,
    precisionRatio: result.precisionRatio,
    precisionPasses: result.precisionPasses,
    status: 'adjusted',
  });

  // Update adjusted coordinates in traverse_stations
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM traverse_stations WHERE traverse_id = ?`, [traverseId]);
  for (const [pointNumber, coords] of Object.entries(result.adjustedCoordinates)) {
    await db.runAsync(
      `INSERT INTO traverse_stations (id, traverse_id, point_number, easting, northing, station_type)
       VALUES (?, ?, ?, ?, ?, 'traverse')`,
      [generateId(), traverseId, pointNumber, coords.easting, coords.northing]
    );
  }
}

async function updateTraverseStats(
  traverseId: string,
  stats: Partial<Pick<Traverse, 'perimeter' | 'linearMisclosure' | 'precisionRatio' | 'precisionPasses' | 'status'>>
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: any[] = [];
  if (stats.perimeter !== undefined) { sets.push('perimeter = ?'); values.push(stats.perimeter); }
  if (stats.linearMisclosure !== undefined) { sets.push('linear_misclosure = ?'); values.push(stats.linearMisclosure); }
  if (stats.precisionRatio !== undefined) { sets.push('precision_ratio = ?'); values.push(stats.precisionRatio); }
  if (stats.precisionPasses !== undefined) { sets.push('precision_passes = ?'); values.push(stats.precisionPasses ? 1 : 0); }
  if (stats.status !== undefined) { sets.push('status = ?'); values.push(stats.status); }
  sets.push('updated_at = ?'); values.push(nowISO());
  values.push(traverseId);
  await db.runAsync(`UPDATE traverses SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function deleteTraverse(traverseId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM traverses WHERE id = ?`, [traverseId]);
}

/**
 * Compute a live Bowditch adjustment preview without saving.
 */
export function computePreview(
  legs: TraverseLeg[],
  startEasting: number,
  startNorthing: number,
  closeEasting?: number,
  closeNorthing?: number
): TraverseAdjustmentResult {
  return bowditchAdjust(
    legs,
    { easting: startEasting, northing: startNorthing },
    closeEasting !== undefined && closeNorthing !== undefined
      ? { easting: closeEasting, northing: closeNorthing }
      : undefined
  );
}

function rowToTraverse(r: any): Traverse {
  return {
    id: r.id,
    projectId: r.project_id,
    sessionId: r.session_id ?? undefined,
    name: r.name,
    surveyType: r.survey_type,
    adjustmentMethod: r.adjustment_method,
    startPointNumber: r.start_point_number,
    closingPointNumber: r.closing_point_number ?? undefined,
    perimeter: r.perimeter ?? 0,
    linearMisclosure: r.linear_misclosure ?? undefined,
    angularMisclosure: r.angular_misclosure ?? undefined,
    precisionRatio: r.precision_ratio ?? undefined,
    precisionPasses: r.precision_passes ? Boolean(r.precision_passes) : undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
