/**
 * Metardu Access — SQLite Database Layer
 * Schema ported from metardu-desktop's `electron/database.ts` v3 (with adaptations).
 * Uses expo-sqlite. Same shape as metardu-desktop's .metardu files for cross-compatibility.
 */

import * as SQLite from 'expo-sqlite';
import { v4 as uuidv4 } from 'uuid';

const DB_NAME = 'metardu-access.db';
const SCHEMA_VERSION = 5;

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await dbInstance.execAsync('PRAGMA journal_mode = WAL;');
    await dbInstance.execAsync('PRAGMA foreign_keys = ON;');
    await initSchema(dbInstance);
  }
  return dbInstance;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  // schema_version
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const currentVersion = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1;'
  );

  if (!currentVersion || currentVersion.version < 1) {
    await v1(db);
  }
  if (!currentVersion || currentVersion.version < 2) {
    await v2(db);
  }
  if (!currentVersion || currentVersion.version < 3) {
    await v3(db);
  }
  if (!currentVersion || currentVersion.version < 4) {
    await v4(db);
  }
  if (!currentVersion || currentVersion.version < 5) {
    await v5(db);
  }
}

// ============================================================================
// v1 — Walking skeleton (matches metardu-desktop v1)
// ============================================================================
async function v1(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      survey_type TEXT NOT NULL,
      survey_order TEXT NOT NULL DEFAULT 'third',
      status TEXT NOT NULL DEFAULT 'draft',
      country TEXT NOT NULL DEFAULT 'KEN',
      county TEXT,
      sub_county TEXT,
      lr_number TEXT,
      datum TEXT NOT NULL DEFAULT 'ARC1960',
      projection TEXT NOT NULL DEFAULT 'UTM37S',
      crs_epsg INTEGER NOT NULL DEFAULT 21037,
      zone INTEGER,
      surveyor_name TEXT NOT NULL,
      surveyor_license TEXT NOT NULL,
      client_name TEXT,
      client_contact TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      local_path TEXT
    );

    CREATE TABLE IF NOT EXISTS points (
      id TEXT PRIMARY KEY,
      point_number TEXT NOT NULL,
      easting REAL NOT NULL,
      northing REAL NOT NULL,
      elevation REAL NOT NULL,
      code TEXT,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      timestamp TEXT NOT NULL,
      raw TEXT,
      photo_uri TEXT,
      session_id TEXT,
      project_id TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_points_project ON points(project_id);
    CREATE INDEX IF NOT EXISTS idx_points_session ON points(session_id);
    CREATE INDEX IF NOT EXISTS idx_points_number ON points(point_number);

    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      project_id TEXT NOT NULL,
      from_point TEXT NOT NULL,
      to_point TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'angle_distance',
      raw_horizontal_angle REAL,
      raw_vertical_angle REAL,
      raw_slope_distance REAL,
      raw_horizontal_distance REAL,
      raw_vertical_distance REAL,
      face TEXT NOT NULL DEFAULT 'left',
      edm_constant REAL,
      ppm_setting REAL,
      temperature_c REAL,
      pressure_hpa REAL,
      humidity REAL,
      instrument_height REAL,
      target_height REAL,
      corrected_distance REAL,
      corrected_bearing REAL,
      corrections_log TEXT,
      std_dev_distance REAL,
      std_dev_angle REAL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_obs_project ON observations(project_id);
    CREATE INDEX IF NOT EXISTS idx_obs_session ON observations(session_id);

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_id TEXT,
      entity_type TEXT,
      user_id TEXT,
      metadata TEXT,
      signature TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

    INSERT INTO schema_version (version) VALUES (1);
  `);
}

// ============================================================================
// v2 — Cadastral (matches metardu-desktop v2)
// ============================================================================
async function v2(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS traverses (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      session_id TEXT,
      name TEXT NOT NULL,
      survey_type TEXT NOT NULL,
      adjustment_method TEXT NOT NULL DEFAULT 'bowditch',
      start_point_number TEXT NOT NULL,
      closing_point_number TEXT,
      perimeter REAL,
      linear_misclosure REAL,
      angular_misclosure REAL,
      precision_ratio TEXT,
      precision_passes INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_trav_project ON traverses(project_id);

    CREATE TABLE IF NOT EXISTS traverse_legs (
      id TEXT PRIMARY KEY,
      traverse_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      from_point TEXT NOT NULL,
      to_point TEXT NOT NULL,
      distance REAL,
      bearing REAL,
      FOREIGN KEY (traverse_id) REFERENCES traverses(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_legs_traverse ON traverse_legs(traverse_id);

    CREATE TABLE IF NOT EXISTS traverse_stations (
      id TEXT PRIMARY KEY,
      traverse_id TEXT NOT NULL,
      point_number TEXT NOT NULL,
      easting REAL,
      northing REAL,
      elevation REAL,
      station_type TEXT NOT NULL DEFAULT 'traverse',
      FOREIGN KEY (traverse_id) REFERENCES traverses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parcels (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parcel_number TEXT NOT NULL,
      lr_number TEXT,
      registry TEXT,
      area_sqm REAL,
      perimeter_m REAL,
      traverse_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (traverse_id) REFERENCES traverses(id)
    );

    CREATE INDEX IF NOT EXISTS idx_parcels_project ON parcels(project_id);

    CREATE TABLE IF NOT EXISTS parcel_points (
      id TEXT PRIMARY KEY,
      parcel_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      point_number TEXT NOT NULL,
      is_beacon INTEGER NOT NULL DEFAULT 0,
      beacon_type TEXT,
      condition TEXT,
      FOREIGN KEY (parcel_id) REFERENCES parcels(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_parcel_pts_parcel ON parcel_points(parcel_id);

    CREATE TABLE IF NOT EXISTS beacons (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      point_number TEXT NOT NULL,
      beacon_type TEXT NOT NULL DEFAULT 'concrete',
      condition TEXT NOT NULL DEFAULT 'good',
      photo_uri TEXT,
      description TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deed_plans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parcel_id TEXT,
      plan_number TEXT,
      deed_plan_number TEXT,
      registry_map_sheet TEXT,
      paper_size TEXT DEFAULT 'A3',
      scale TEXT DEFAULT '1:1000',
      pdf_path TEXT,
      pdf_hash TEXT,
      sealed INTEGER NOT NULL DEFAULT 0,
      seal_payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS surveyor_certificates (
      id TEXT PRIMARY KEY,
      surveyor_name TEXT NOT NULL,
      surveyor_license TEXT NOT NULL,
      firm_name TEXT,
      certificate_text TEXT,
      document_hash TEXT,
      seal_method TEXT NOT NULL DEFAULT 'pending',
      public_key_pem TEXT,
      signature_base64 TEXT,
      created_at TEXT NOT NULL
    );

    INSERT INTO schema_version (version) VALUES (2);
  `);
}

// ============================================================================
// v3 — Sectional properties + sync queue + surveyor profiles (Metardu Access additions)
// ============================================================================
async function v3(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- Sectional Properties Act 2020 (Kenya)
    CREATE TABLE IF NOT EXISTS sectional_properties (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      development_name TEXT NOT NULL,
      parcel_number TEXT NOT NULL,
      total_units INTEGER NOT NULL DEFAULT 0,
      total_floors INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sectional_units (
      id TEXT PRIMARY KEY,
      sectional_property_id TEXT NOT NULL,
      unit_number TEXT NOT NULL,
      floor INTEGER NOT NULL,
      area_sqm REAL NOT NULL,
      floor_plan_uri TEXT,
      FOREIGN KEY (sectional_property_id) REFERENCES sectional_properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exclusive_use_areas (
      id TEXT PRIMARY KEY,
      sectional_unit_id TEXT NOT NULL,
      type TEXT NOT NULL,
      area_sqm REAL NOT NULL,
      description TEXT,
      FOREIGN KEY (sectional_unit_id) REFERENCES sectional_units(id) ON DELETE CASCADE
    );

    -- parcel_points v3 additions (matches metardu-desktop v3)
    ALTER TABLE parcel_points ADD COLUMN seq INTEGER DEFAULT 0;
    ALTER TABLE parcel_points ADD COLUMN is_beacon INTEGER DEFAULT 0;

    -- Sync queue (Metardu Access specific)
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      queued_at TEXT NOT NULL,
      last_attempt_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(attempts, queued_at);

    -- Surveyor profile (local)
    CREATE TABLE IF NOT EXISTS surveyor_profile (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      isk_number TEXT NOT NULL,
      verified_isk INTEGER NOT NULL DEFAULT 0,
      firm_name TEXT,
      license_expiry TEXT,
      api_key TEXT,
      public_key_pem TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    -- Field sessions (for sync tracking)
    CREATE TABLE IF NOT EXISTS field_sessions (
      session_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      surveyor_id TEXT,
      surveyor_name TEXT,
      surveyor_license TEXT,
      project_name TEXT,
      county TEXT,
      survey_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      instrument TEXT,
      station TEXT,
      crs TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      synced_at TEXT,
      notes TEXT,
      weather TEXT,
      point_count INTEGER NOT NULL DEFAULT 0,
      observation_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_project ON field_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_sync ON field_sessions(sync_status);

    INSERT INTO schema_version (version) VALUES (3);
  `);
}

// ============================================================================
// v4 — Topographic field capture: breaklines + feature codes + breakline points
// ============================================================================
async function v4(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- Feature codes (TREE, BUILD, ROAD, FENCE, etc.)
    -- Layer grouping: utilities, vegetation, structures, hydrology, transport
    CREATE TABLE IF NOT EXISTS feature_codes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      layer TEXT NOT NULL DEFAULT 'general',
      color TEXT NOT NULL DEFAULT '#F97316',
      icon TEXT NOT NULL DEFAULT 'map-marker',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(project_id, code)
    );

    -- Breaklines: ridge lines, road edges, water courses, retaining walls, etc.
    -- Each breakline is a sequence of point numbers that constrain the TIN.
    -- Type:
    --   'hard'  — man-made (road edge, wall, building footing) — TIN edges follow exactly
    --   'soft'  — natural (ridge, valley, water course) — TIN edges follow approximately
    --   'boundary' — outer boundary of survey area
    CREATE TABLE IF NOT EXISTS breaklines (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'soft',
      layer TEXT,
      point_count INTEGER NOT NULL DEFAULT 0,
      length_m REAL NOT NULL DEFAULT 0,
      captured_at TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_breaklines_project ON breaklines(project_id);
    CREATE INDEX IF NOT EXISTS idx_breaklines_type ON breaklines(type);

    -- Breakline vertices (ordered sequence of points)
    CREATE TABLE IF NOT EXISTS breakline_points (
      id TEXT PRIMARY KEY,
      breakline_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      point_number TEXT NOT NULL,
      easting REAL,
      northing REAL,
      elevation REAL,
      captured_at TEXT NOT NULL,
      FOREIGN KEY (breakline_id) REFERENCES breaklines(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_blp_breakline ON breakline_points(breakline_id);
    CREATE INDEX IF NOT EXISTS idx_blp_seq ON breakline_points(breakline_id, seq);

    INSERT INTO schema_version (version) VALUES (4);
  `);
}

// ============================================================================
// v5 — Drone / UAV: GCPs (Ground Control Points) + flight missions + RINEX
// ============================================================================
async function v5(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    -- Ground Control Points (GCPs) for drone photogrammetry
    -- Surveyed with cm-level GNSS RTK; used to georeference drone imagery
    -- on the desktop's WebODM / Pix4D pipeline
    CREATE TABLE IF NOT EXISTS gcps (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      gcp_id TEXT NOT NULL,              -- user-visible ID, e.g. GCP-001
      easting REAL NOT NULL,
      northing REAL NOT NULL,
      elevation REAL NOT NULL,
      lat REAL,                          -- WGS84 latitude (for desktop GCP file)
      lng REAL,                          -- WGS84 longitude
      height REAL,                       -- WGS84 ellipsoidal height
      accuracy_mm REAL,                  -- achieved accuracy in mm
      solution_type TEXT,                -- 'fixed' | 'float' | 'single' | 'dgps'
      num_satellites INTEGER,
      photo_uri TEXT,                    -- photo of the GCP target on the ground
      target_type TEXT,                  -- 'checkerboard' | 'cross' | 'natural'
      target_size_m REAL,                -- target size in meters
      captured_at TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_gcps_project ON gcps(project_id);
    CREATE INDEX IF NOT EXISTS idx_gcps_id ON gcps(gcp_id);

    -- Drone flight missions
    CREATE TABLE IF NOT EXISTS drone_missions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      drone_type TEXT,                   -- 'dji_phantom' | 'dji_mavic' | 'parrot' | 'fixed_wing' | 'other'
      planned_altitude_m REAL,           -- AGL (above ground level)
      planned_speed_ms REAL,             -- m/s
      overlap_frontal REAL,              -- 0-100 (%)
      overlap_side REAL,                 -- 0-100 (%)
      area_covered_sqm REAL,
      photo_count INTEGER NOT NULL DEFAULT 0,
      flight_start TEXT,
      flight_end TEXT,
      status TEXT NOT NULL DEFAULT 'planned', -- 'planned' | 'flying' | 'completed' | 'failed'
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_missions_project ON drone_missions(project_id);

    -- Flight photos (linked to drone mission)
    -- Each photo has a GPS position from the drone's EXIF data
    CREATE TABLE IF NOT EXISTS flight_photos (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      photo_uri TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      lat REAL,                          -- drone GPS at capture
      lng REAL,
      altitude_m REAL,                   -- AGL or MSL depending on drone config
      yaw_deg REAL,                      -- camera yaw
      pitch_deg REAL,
      roll_deg REAL,
      FOREIGN KEY (mission_id) REFERENCES drone_missions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_photos_mission ON flight_photos(mission_id);

    INSERT INTO schema_version (version) VALUES (5);
  `);
}

// ============================================================================
// Helpers
// ============================================================================
export function generateId(): string {
  return uuidv4();
}

export function nowISO(): string {
  return new Date().toISOString();
}
