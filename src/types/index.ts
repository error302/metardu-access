/**
 * Metardu Access — Type Definitions
 * Domain models shared with metardu (web) and metardu-desktop per SYNC_API_CONTRACT.md
 */

// ============================================================================
// Survey Types (matches metardu web's 9 types; MVP supports first 4)
// ============================================================================
export type SurveyType =
  | 'cadastral'
  | 'engineering'
  | 'topographic'
  | 'sectional'
  | 'geodetic'
  | 'mining'
  | 'hydrographic'
  | 'drone'
  | 'deformation';

export type SurveyMethod = 'traverse' | 'triangulation' | 'gps' | 'leveling' | 'mixed';

export type SurveyOrder = 'first' | 'second' | 'third' | 'fourth';

export type SurveyStatus = 'draft' | 'active' | 'completed' | 'synced' | 'sealed' | 'submitted';

// ============================================================================
// Project
// ============================================================================
export interface Project {
  id: string; // UUID
  name: string;
  surveyType: SurveyType;
  surveyOrder: SurveyOrder;
  status: SurveyStatus;
  country: string; // ISO3, e.g. 'KEN'
  county?: string;
  subCounty?: string;
  lrNumber?: string; // Land Reference number
  datum: string; // 'ARC1960' for Kenya
  projection: string; // 'UTM37S'
  crsEpsg: number; // 21037 for Kenya
  zone?: number;
  surveyorName: string;
  surveyorLicense: string; // e.g. 'ISK/1234'
  clientName?: string;
  clientContact?: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  syncStatus: SyncStatus;
  // Local-only metadata
  localPath?: string; // SQLite file path if project has its own DB
}

// ============================================================================
// Field Session (the sync unit per SYNC_API_CONTRACT.md)
// ============================================================================
export interface FieldSession {
  sessionId: string; // UUID
  surveyorId: string;
  surveyorName: string;
  surveyorLicense: string; // ISK/1234
  projectName: string;
  projectId: string;
  county?: string;
  surveyType: SurveyType;
  startDate: string; // ISO 8601
  endDate?: string;
  instrument?: InstrumentInfo;
  station?: StationSetup;
  points: SurveyPoint[];
  observations: Observation[];
  crs: {
    epsg: number;
    name: string;
    datum: string;
  };
  syncStatus: SyncStatus;
  syncedAt?: string;
  notes?: string;
  weather?: WeatherInfo;
}

export interface InstrumentInfo {
  type: 'total_station' | 'gnss_rtk' | 'gnss_ppk' | 'level' | 'drone' | 'manual';
  brand: string;
  model: string;
  serialNumber: string;
  calibrationDate?: string;
}

export interface StationSetup {
  stationNumber: string;
  easting: number;
  northing: number;
  elevation: number;
  backsight?: string; // backsight station number
  instrumentHeight: number;
  targetHeight?: number;
}

export interface WeatherInfo {
  temperatureC: number;
  pressurehPa: number;
  humidity?: number;
  recordedAt: string;
}

// ============================================================================
// Survey Point (the immutable field record)
// ============================================================================
export type PointSource = 'csv' | 'gnss' | 'total_station' | 'manual' | 'imported';

export interface SurveyPoint {
  pointNumber: string;
  easting: number;
  northing: number;
  elevation: number;
  code?: string; // feature code (TREE, BUILD, ROAD, etc.)
  description?: string;
  source: PointSource;
  timestamp: string; // ISO 8601
  raw?: Record<string, unknown>; // raw instrument data per SYNC_API_CONTRACT
  photoUri?: string;
  sessionId: string;
  projectId: string;
}

// ============================================================================
// Observation (traverse / level / angle-distance)
// ============================================================================
export type ObservationFace = 'left' | 'right';
export type ObservationType = 'angle_distance' | 'distance_only' | 'angle_only' | 'level';

export interface Observation {
  id: string;
  sessionId: string;
  fromPoint: string;
  toPoint: string;
  type: ObservationType;
  // Raw measurements
  rawHorizontalAngle?: number; // degrees
  rawVerticalAngle?: number; // degrees
  rawSlopeDistance?: number; // meters
  rawHorizontalDistance?: number; // meters
  rawVerticalDistance?: number; // meters
  face: ObservationFace;
  // Corrections (applied by engine)
  edmConstant?: number;
  ppmSetting?: number;
  temperatureC?: number;
  pressurehPa?: number;
  humidity?: number;
  instrumentHeight?: number;
  targetHeight?: number;
  // Computed (filled by engine)
  correctedDistance?: number;
  correctedBearing?: number;
  correctionsLog?: Record<string, unknown>;
  stdDevDistance?: number;
  stdDevAngle?: number;
  timestamp: string;
}

// ============================================================================
// Traverse (cadastral / engineering)
// ============================================================================
export type AdjustmentMethod = 'bowditch' | 'transit' | 'least_squares' | 'none';

export interface Traverse {
  id: string;
  projectId: string;
  sessionId: string;
  name: string;
  surveyType: SurveyType;
  adjustmentMethod: AdjustmentMethod;
  startPointNumber: string;
  closingPointNumber?: string;
  perimeter: number;
  linearMisclosure?: number;
  angularMisclosure?: number;
  precisionRatio?: string; // '1:5000'
  precisionPasses?: boolean;
  status: 'draft' | 'adjusted' | 'sealed' | 'submitted';
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Parcel (cadastral)
// ============================================================================
export interface Parcel {
  id: string;
  projectId: string;
  parcelNumber: string; // e.g. 'LR 12345/6'
  lrNumber: string;
  registry: string;
  areaSqm: number;
  perimeterM: number;
  traverseId: string;
  status: 'draft' | 'surveyed' | 'sealed' | 'registered';
  points: ParcelPoint[];
}

export interface ParcelPoint {
  seq: number;
  pointNumber: string;
  isBeacon: boolean;
  beaconType?: 'concrete' | 'iron_pin' | 'stone' | 'natural';
  condition?: 'good' | 'disturbed' | 'destroyed' | 'missing';
}

// ============================================================================
// Sectional Property (Sectional Properties Act 2020, Kenya)
// ============================================================================
export interface SectionalProperty {
  id: string;
  projectId: string;
  developmentName: string;
  parcelNumber: string; // parent parcel
  totalUnits: number;
  totalFloors: number;
  units: SectionalUnit[];
  status: 'draft' | 'surveyed' | 'sealed' | 'registered';
}

export interface SectionalUnit {
  id: string;
  unitNumber: string;
  floor: number;
  areaSqm: number;
  exclusiveUseAreas?: ExclusiveUseArea[];
  floorPlanUri?: string;
}

export interface ExclusiveUseArea {
  id: string;
  type: 'balcony' | 'parking' | 'garden' | 'storage' | 'terrace';
  areaSqm: number;
  description?: string;
}

// ============================================================================
// Sync Status
// ============================================================================
export type SyncStatus = 'pending' | 'queued' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface SyncQueueItem {
  id: string;
  sessionId: string;
  projectId: string;
  payload: FieldSession;
  attempts: number;
  lastError?: string;
  queuedAt: string;
  lastAttemptAt?: string;
}

// ============================================================================
// Surveyor Profile (local)
// ============================================================================
export interface SurveyorProfile {
  id: string;
  email: string;
  fullName: string;
  iskNumber: string; // 'ISK/1234'
  verifiedIsk: boolean;
  firmName?: string;
  licenseExpiry?: string;
  apiKey?: string; // sync API key (stored in secure store)
  publicKeyPem?: string; // for crypto seals
  createdAt: string;
  lastLoginAt?: string;
}

// ============================================================================
// Audit Log (regulatory)
// ============================================================================
export type AuditAction =
  | 'create_session'
  | 'add_point'
  | 'add_observation'
  | 'edit_point'
  | 'delete_point'
  | 'seal_session'
  | 'sync_session'
  | 'export_session'
  | 'login'
  | 'logout'
  | 'settings_change';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  entityId: string;
  entityType: string;
  userId: string;
  metadata?: Record<string, unknown>;
  signature?: string; // crypto signature for tamper-evidence
}

// ============================================================================
// Country Pack (matches metardu-desktop ADR-005)
// ============================================================================
export interface CountryPack {
  iso3: string; // 'KEN'
  name: string;
  defaultCrs: {
    epsg: number;
    name: string;
    datum: string;
    projection: string;
  };
  regulatoryBody: string; // 'Survey of Kenya'
  statutoryDocuments: string[];
  submissionFormat: string; // 'NLIMS-JSON-1.0'
  locale: string;
}

// ============================================================================
// Feature Codes (topographic)
// ============================================================================
export type FeatureLayer =
  | 'vegetation'
  | 'structures'
  | 'transport'
  | 'hydrology'
  | 'utilities'
  | 'contours'
  | 'general';

export interface FeatureCode {
  id: string;
  projectId: string;
  code: string;          // short code: TREE, BUILD, ROAD, FENCE
  description?: string;
  layer: FeatureLayer;
  color: string;         // hex
  icon: string;          // MaterialCommunityIcons name
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// Breaklines (constrain TIN surface)
// ============================================================================
export type BreaklineType = 'hard' | 'soft' | 'boundary';

export interface Breakline {
  id: string;
  projectId: string;
  name: string;
  type: BreaklineType;
  layer?: string;
  pointCount: number;
  lengthM: number;
  capturedAt: string;
  notes?: string;
}

export interface BreaklinePoint {
  id: string;
  breaklineId: string;
  seq: number;
  pointNumber: string;
  easting?: number;
  northing?: number;
  elevation?: number;
  capturedAt: string;
}

export interface BreaklineWithPoints extends Breakline {
  points: BreaklinePoint[];
}
