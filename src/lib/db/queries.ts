/**
 * Database query helpers — typed wrappers over expo-sqlite for common operations.
 */

import { getDatabase, generateId, nowISO } from './schema';
import type {
  Project,
  FieldSession,
  SurveyPoint,
  Observation,
  AuditEntry,
  AuditAction,
  SurveyorProfile,
  SyncQueueItem,
  Traverse,
  Parcel,
} from '@/types';

// ============================================================================
// Projects
// ============================================================================
export async function createProject(
  input: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>
): Promise<Project> {
  const db = await getDatabase();
  const project: Project = {
    ...input,
    id: generateId(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    syncStatus: 'pending',
  };

  await db.runAsync(
    `INSERT INTO projects (
      id, name, survey_type, survey_order, status, country, county, sub_county,
      lr_number, datum, projection, crs_epsg, zone, surveyor_name, surveyor_license,
      client_name, client_contact, created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.name,
      project.surveyType,
      project.surveyOrder,
      project.status,
      project.country,
      project.county ?? null,
      project.subCounty ?? null,
      project.lrNumber ?? null,
      project.datum,
      project.projection,
      project.crsEpsg,
      project.zone ?? null,
      project.surveyorName,
      project.surveyorLicense,
      project.clientName ?? null,
      project.clientContact ?? null,
      project.createdAt,
      project.updatedAt,
      project.syncStatus,
    ]
  );

  await auditLog('create_session', project.id, 'project', { name: project.name });
  return project;
}

export async function getProjects(): Promise<Project[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM projects ORDER BY updated_at DESC`
  );
  return rows.map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(`SELECT * FROM projects WHERE id = ?`, [id]);
  return row ? rowToProject(row) : null;
}

export async function updateProject(
  id: string,
  updates: Partial<Project>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    surveyType: 'survey_type',
    surveyOrder: 'survey_order',
    status: 'status',
    county: 'county',
    subCounty: 'sub_county',
    lrNumber: 'lr_number',
    zone: 'zone',
    surveyorName: 'surveyor_name',
    surveyorLicense: 'surveyor_license',
    clientName: 'client_name',
    clientContact: 'client_contact',
    syncStatus: 'sync_status',
  };

  for (const [k, v] of Object.entries(updates)) {
    if (fieldMap[k]) {
      fields.push(`${fieldMap[k]} = ?`);
      values.push(v);
    }
  }
  fields.push(`updated_at = ?`);
  values.push(nowISO());
  values.push(id);

  await db.runAsync(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM projects WHERE id = ?`, [id]);
}

// ============================================================================
// Points
// ============================================================================
export async function addPoint(
  point: Omit<SurveyPoint, 'timestamp'> & { timestamp?: string }
): Promise<SurveyPoint> {
  const db = await getDatabase();
  const fullPoint: SurveyPoint = {
    ...point,
    timestamp: point.timestamp ?? nowISO(),
  };
  await db.runAsync(
    `INSERT INTO points (
      id, point_number, easting, northing, elevation, code, description,
      source, timestamp, raw, photo_uri, session_id, project_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      fullPoint.pointNumber,
      fullPoint.easting,
      fullPoint.northing,
      fullPoint.elevation,
      fullPoint.code ?? null,
      fullPoint.description ?? null,
      fullPoint.source,
      fullPoint.timestamp,
      fullPoint.raw ? JSON.stringify(fullPoint.raw) : null,
      fullPoint.photoUri ?? null,
      fullPoint.sessionId ?? null,
      fullPoint.projectId,
    ]
  );
  await auditLog('add_point', fullPoint.projectId, 'project', {
    pointNumber: fullPoint.pointNumber,
    source: fullPoint.source,
  });
  return fullPoint;
}

export async function getPoints(projectId: string): Promise<SurveyPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM points WHERE project_id = ? ORDER BY timestamp DESC`,
    [projectId]
  );
  return rows.map(rowToPoint);
}

export async function getPointsBySession(sessionId: string): Promise<SurveyPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM points WHERE session_id = ? ORDER BY timestamp ASC`,
    [sessionId]
  );
  return rows.map(rowToPoint);
}

// ============================================================================
// Observations
// ============================================================================
export async function addObservation(
  obs: Omit<Observation, 'id' | 'timestamp'> & { timestamp?: string }
): Promise<Observation> {
  const db = await getDatabase();
  const full: Observation = {
    ...obs,
    id: generateId(),
    timestamp: obs.timestamp ?? nowISO(),
  };
  await db.runAsync(
    `INSERT INTO observations (
      id, session_id, project_id, from_point, to_point, type,
      raw_horizontal_angle, raw_vertical_angle, raw_slope_distance,
      raw_horizontal_distance, raw_vertical_distance, face,
      edm_constant, ppm_setting, temperature_c, pressure_hpa, humidity,
      instrument_height, target_height, corrected_distance, corrected_bearing,
      corrections_log, std_dev_distance, std_dev_angle, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      full.id,
      full.sessionId,
      full.projectId,
      full.fromPoint,
      full.toPoint,
      full.type,
      full.rawHorizontalAngle ?? null,
      full.rawVerticalAngle ?? null,
      full.rawSlopeDistance ?? null,
      full.rawHorizontalDistance ?? null,
      full.rawVerticalDistance ?? null,
      full.face,
      full.edmConstant ?? null,
      full.ppmSetting ?? null,
      full.temperatureC ?? null,
      full.pressurehPa ?? null,
      full.humidity ?? null,
      full.instrumentHeight ?? null,
      full.targetHeight ?? null,
      full.correctedDistance ?? null,
      full.correctedBearing ?? null,
      full.correctionsLog ? JSON.stringify(full.correctionsLog) : null,
      full.stdDevDistance ?? null,
      full.stdDevAngle ?? null,
      full.timestamp,
    ]
  );
  await auditLog('add_observation', full.projectId, 'project', {
    from: full.fromPoint,
    to: full.toPoint,
    type: full.type,
  });
  return full;
}

export async function getObservations(sessionId: string): Promise<Observation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM observations WHERE session_id = ? ORDER BY timestamp ASC`,
    [sessionId]
  );
  return rows.map(rowToObservation);
}

// ============================================================================
// Audit Log
// ============================================================================
export async function auditLog(
  action: AuditAction,
  entityId: string,
  entityType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO audit_log (id, timestamp, action, entity_id, entity_type, user_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      nowISO(),
      action,
      entityId,
      entityType,
      'local-user', // replaced with surveyor id when authed
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

export async function getAuditLog(entityId?: string, limit = 100): Promise<AuditEntry[]> {
  const db = await getDatabase();
  const rows = entityId
    ? await db.getAllAsync<any>(
        `SELECT * FROM audit_log WHERE entity_id = ? ORDER BY timestamp DESC LIMIT ?`,
        [entityId, limit]
      )
    : await db.getAllAsync<any>(
        `SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?`,
        [limit]
      );
  return rows.map(rowToAudit);
}

// ============================================================================
// Surveyor Profile
// ============================================================================
export async function saveSurveyorProfile(profile: SurveyorProfile): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO surveyor_profile (
      id, email, full_name, isk_number, verified_isk, firm_name, license_expiry,
      api_key, public_key_pem, created_at, last_login_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.email,
      profile.fullName,
      profile.iskNumber,
      profile.verifiedIsk ? 1 : 0,
      profile.firmName ?? null,
      profile.licenseExpiry ?? null,
      profile.apiKey ?? null,
      profile.publicKeyPem ?? null,
      profile.createdAt,
      profile.lastLoginAt ?? null,
    ]
  );
}

export async function getSurveyorProfile(): Promise<SurveyorProfile | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM surveyor_profile ORDER BY created_at DESC LIMIT 1`
  );
  return row ? rowToSurveyor(row) : null;
}

// ============================================================================
// Sync Queue
// ============================================================================
export async function enqueueSync(payload: FieldSession): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO sync_queue (
      id, session_id, project_id, payload, attempts, queued_at
    ) VALUES (?, ?, ?, ?, 0, ?)`,
    [
      generateId(),
      payload.sessionId,
      payload.projectId,
      JSON.stringify(payload),
      nowISO(),
    ]
  );
  // Mark session as queued
  await db.runAsync(
    `UPDATE field_sessions SET sync_status = 'queued' WHERE session_id = ?`,
    [payload.sessionId]
  );
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM sync_queue ORDER BY queued_at ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    projectId: r.project_id,
    payload: JSON.parse(r.payload),
    attempts: r.attempts,
    lastError: r.last_error ?? undefined,
    queuedAt: r.queued_at,
    lastAttemptAt: r.last_attempt_at ?? undefined,
  }));
}

export async function markSynced(sessionId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_queue WHERE session_id = ?`, [sessionId]);
  await db.runAsync(
    `UPDATE field_sessions SET sync_status = 'synced', synced_at = ? WHERE session_id = ?`,
    [nowISO(), sessionId]
  );
}

export async function markSyncFailed(sessionId: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET attempts = attempts + 1, last_error = ?, last_attempt_at = ? WHERE session_id = ?`,
    [error, nowISO(), sessionId]
  );
  await db.runAsync(
    `UPDATE field_sessions SET sync_status = 'failed' WHERE session_id = ?`,
    [sessionId]
  );
}

// ============================================================================
// Row mappers
// ============================================================================
function rowToProject(r: any): Project {
  return {
    id: r.id,
    name: r.name,
    surveyType: r.survey_type,
    surveyOrder: r.survey_order,
    status: r.status,
    country: r.country,
    county: r.county ?? undefined,
    subCounty: r.sub_county ?? undefined,
    lrNumber: r.lr_number ?? undefined,
    datum: r.datum,
    projection: r.projection,
    crsEpsg: r.crs_epsg,
    zone: r.zone ?? undefined,
    surveyorName: r.surveyor_name,
    surveyorLicense: r.surveyor_license,
    clientName: r.client_name ?? undefined,
    clientContact: r.client_contact ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    syncStatus: r.sync_status,
    localPath: r.local_path ?? undefined,
  };
}

function rowToPoint(r: any): SurveyPoint {
  return {
    pointNumber: r.point_number,
    easting: r.easting,
    northing: r.northing,
    elevation: r.elevation,
    code: r.code ?? undefined,
    description: r.description ?? undefined,
    source: r.source,
    timestamp: r.timestamp,
    raw: r.raw ? JSON.parse(r.raw) : undefined,
    photoUri: r.photo_uri ?? undefined,
    sessionId: r.session_id ?? undefined,
    projectId: r.project_id,
  };
}

function rowToObservation(r: any): Observation {
  return {
    id: r.id,
    sessionId: r.session_id,
    projectId: r.project_id,
    fromPoint: r.from_point,
    toPoint: r.to_point,
    type: r.type,
    rawHorizontalAngle: r.raw_horizontal_angle ?? undefined,
    rawVerticalAngle: r.raw_vertical_angle ?? undefined,
    rawSlopeDistance: r.raw_slope_distance ?? undefined,
    rawHorizontalDistance: r.raw_horizontal_distance ?? undefined,
    rawVerticalDistance: r.raw_vertical_distance ?? undefined,
    face: r.face,
    edmConstant: r.edm_constant ?? undefined,
    ppmSetting: r.ppm_setting ?? undefined,
    temperatureC: r.temperature_c ?? undefined,
    pressurehPa: r.pressure_hpa ?? undefined,
    humidity: r.humidity ?? undefined,
    instrumentHeight: r.instrument_height ?? undefined,
    targetHeight: r.target_height ?? undefined,
    correctedDistance: r.corrected_distance ?? undefined,
    correctedBearing: r.corrected_bearing ?? undefined,
    correctionsLog: r.corrections_log ? JSON.parse(r.corrections_log) : undefined,
    stdDevDistance: r.std_dev_distance ?? undefined,
    stdDevAngle: r.std_dev_angle ?? undefined,
    timestamp: r.timestamp,
  };
}

function rowToAudit(r: any): AuditEntry {
  return {
    id: r.id,
    timestamp: r.timestamp,
    action: r.action,
    entityId: r.entity_id,
    entityType: r.entity_type,
    userId: r.user_id,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    signature: r.signature ?? undefined,
  };
}

function rowToSurveyor(r: any): SurveyorProfile {
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    iskNumber: r.isk_number,
    verifiedIsk: Boolean(r.verified_isk),
    firmName: r.firm_name ?? undefined,
    licenseExpiry: r.license_expiry ?? undefined,
    apiKey: r.api_key ?? undefined,
    publicKeyPem: r.public_key_pem ?? undefined,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at ?? undefined,
  };
}
