/**
 * @metardu/engine — GCP (Ground Control Point) utilities
 *
 * Provides:
 *   1. GCP distribution assessment (good spatial coverage?)
 *   2. GCP file format conversion (CSV, GeoJSON, WebODM format)
 *   3. Accuracy classification per Kenya surveying standards
 *
 * The actual photogrammetric processing (drone imagery → orthomosaic → DEM)
 * happens on the desktop's WebODM / Pix4D pipeline. Mobile captures the GCPs;
 * desktop consumes them.
 */

import { computeBbox, type Point2D } from './breaklines';
import type { SolutionType } from './types';

export interface GCPInput {
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
  targetType?: string;
}

export interface GCPDistributionAssessment {
  count: number;
  bboxArea: number;
  density: number;                  // GCPs per km²
  spacing: number;                  // average spacing in meters
  minSpacing: number;
  maxSpacing: number;
  accuracyClass: 'cm' | 'dm' | 'm';
  hasFixedSolution: boolean;
  issues: string[];
  recommendations: string[];
}

/**
 * Assess GCP distribution quality for drone photogrammetry.
 * Rule of thumb: 5-10 GCPs per hectare for cm-level accuracy,
 * distributed evenly across the site perimeter and interior.
 */
export function assessGCPDistribution(gcps: GCPInput[]): GCPDistributionAssessment {
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (gcps.length === 0) {
    return {
      count: 0,
      bboxArea: 0,
      density: 0,
      spacing: 0,
      minSpacing: 0,
      maxSpacing: 0,
      accuracyClass: 'm',
      hasFixedSolution: false,
      issues: ['No GCPs captured.'],
      recommendations: ['Capture at least 5 GCPs distributed across the survey area.'],
    };
  }

  const points: Point2D[] = gcps.map(g => ({ easting: g.easting, northing: g.northing }));
  const bbox = computeBbox(points);
  const areaKm2 = bbox.area / 1_000_000;
  const density = areaKm2 > 0 ? gcps.length / areaKm2 : 0;

  // Compute pairwise distances for spacing analysis
  const distances: number[] = [];
  for (let i = 0; i < gcps.length; i++) {
    let minDist = Infinity;
    for (let j = 0; j < gcps.length; j++) {
      if (i === j) continue;
      const dx = gcps[i].easting - gcps[j].easting;
      const dy = gcps[i].northing - gcps[j].northing;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) minDist = d;
    }
    if (minDist < Infinity) distances.push(minDist);
  }

  const avgSpacing = distances.length > 0
    ? distances.reduce((s, d) => s + d, 0) / distances.length
    : 0;
  const minSpacing = distances.length > 0 ? Math.min(...distances) : 0;
  const maxSpacing = distances.length > 0 ? Math.max(...distances) : 0;

  // Accuracy classification
  const avgAccuracy = gcps
    .filter(g => g.accuracyMm != null)
    .reduce((s, g) => s + (g.accuracyMm ?? 0), 0) / Math.max(1, gcps.filter(g => g.accuracyMm != null).length);

  let accuracyClass: 'cm' | 'dm' | 'm' = 'm';
  if (avgAccuracy <= 20) accuracyClass = 'cm';
  else if (avgAccuracy <= 100) accuracyClass = 'dm';

  const hasFixed = gcps.some(g => g.solutionType === 'fixed');

  // Issues
  if (gcps.length < 5) {
    issues.push(`Only ${gcps.length} GCP(s) — minimum 5 recommended for cm-level drone accuracy.`);
    recommendations.push('Capture more GCPs, distributed across the survey area.');
  }
  if (gcps.length < 10 && areaKm2 > 0.05) {
    issues.push(`GCP density is low (${density.toFixed(1)}/km²) for ${areaKm2.toFixed(2)} km² area.`);
    recommendations.push('Add interior GCPs every 100-200m for better photogrammetric control.');
  }
  if (!hasFixed) {
    issues.push('No RTK Fixed solutions — GCPs may not meet cm-level accuracy.');
    recommendations.push('Wait for better satellite geometry or move to open sky for fixed RTK solution.');
  }
  if (maxSpacing > 200 && distances.length > 1) {
    issues.push(`Maximum GCP spacing is ${maxSpacing.toFixed(0)}m — gaps over 200m reduce accuracy.`);
    recommendations.push(`Add GCPs in sparse areas (gap detected: ${maxSpacing.toFixed(0)}m).`);
  }
  if (minSpacing < 10 && distances.length > 1) {
    issues.push(`Two GCPs are very close (${minSpacing.toFixed(1)}m) — may be redundant.`);
    recommendations.push('Consider removing one of the close GCPs or spreading them more evenly.');
  }

  return {
    count: gcps.length,
    bboxArea: bbox.area,
    density,
    spacing: avgSpacing,
    minSpacing,
    maxSpacing,
    accuracyClass,
    hasFixedSolution: hasFixed,
    issues,
    recommendations,
  };
}

/**
 * Convert GCPs to CSV format (compatible with WebODM, Pix4D, Agisoft).
 * Columns: gcp_id, lat, lng, height (WGS84)
 * Or if no WGS84: gcp_id, easting, northing, elevation (local grid)
 */
export function gcpsToCsv(gcps: GCPInput[], useWgs84: boolean = true): string {
  if (gcps.length === 0) return '';
  const hasWgs84 = gcps.every(g => g.lat != null && g.lng != null);

  if (useWgs84 && hasWgs84) {
    const header = 'gcp_id,lat,lng,height,accuracy_mm,solution_type';
    const rows = gcps.map(g =>
      [
        g.gcpId,
        g.lat?.toFixed(9),
        g.lng?.toFixed(9),
        g.height?.toFixed(4) ?? g.elevation.toFixed(4),
        g.accuracyMm ?? '',
        g.solutionType ?? '',
      ].join(',')
    );
    return [header, ...rows].join('\n');
  }

  // Local grid (UTM) format
  const header = 'gcp_id,easting,northing,elevation,accuracy_mm,solution_type';
  const rows = gcps.map(g =>
    [
      g.gcpId,
      g.easting.toFixed(4),
      g.northing.toFixed(4),
      g.elevation.toFixed(4),
      g.accuracyMm ?? '',
      g.solutionType ?? '',
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Convert GCPs to GeoJSON FeatureCollection.
 * Each GCP is a Point feature with properties for accuracy, solution, etc.
 */
export function gcpsToGeoJSON(gcps: GCPInput[]): object {
  return {
    type: 'FeatureCollection',
    features: gcps.map(g => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: g.lng != null && g.lat != null
          ? [g.lng, g.lat, g.height ?? g.elevation]
          : [g.easting, g.northing, g.elevation],
      },
      properties: {
        gcpId: g.gcpId,
        accuracyMm: g.accuracyMm,
        solutionType: g.solutionType,
        numSatellites: g.numSatellites,
        targetType: g.targetType,
      },
    })),
  };
}

/**
 * WebODM GCP file format:
 * <lat> <lng> <height> "gcp_id"
 * One GCP per line, WGS84 decimal degrees.
 * https://docs.webodm.org/#gcp
 */
export function gcpsToWebODM(gcps: GCPInput[]): string {
  return gcps
    .filter(g => g.lat != null && g.lng != null)
    .map(g => {
      const lat = g.lat!.toFixed(9);
      const lng = g.lng!.toFixed(9);
      const h = (g.height ?? g.elevation).toFixed(4);
      return `${lat} ${lng} ${h} "${g.gcpId}"`;
    })
    .join('\n');
}

/**
 * Generate next GCP ID (sequential).
 */
export function nextGcpId(existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    const match = id.match(/GCP-(\d+)/i);
    if (match) {
      const n = parseInt(match[1]);
      if (n > max) max = n;
    }
  }
  return `GCP-${String(max + 1).padStart(3, '0')}`;
}

// Add SolutionType to engine types for re-export
export type { SolutionType } from './types';
