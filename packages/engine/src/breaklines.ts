/**
 * @metardu/engine — Breakline validation and TIN prep data
 *
 * The actual TIN (Triangulated Irregular Network) generation happens on the
 * desktop. This module provides field-side validation and prepares the
 * breakline data in a format the desktop's TIN engine can consume directly.
 *
 * Responsibilities:
 *   1. Validate breaklines (min 2 points, no duplicates, no self-intersection)
 *   2. Compute breakline length, point density, coverage stats
 *   3. Serialize to TIN-prep JSON (compatible with desktop's expected format)
 *   4. Provide field-side quality checks (point density, coverage gaps)
 */

import { computeBearingDistance, type Point2D } from './cogo';

export interface BreaklineSegment {
  fromPoint: string;
  toPoint: string;
  from: Point2D & { elevation?: number };
  to: Point2D & { elevation?: number };
  length: number;
  slope: number; // percent
}

export interface BreaklineValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  pointCount: number;
  segmentCount: number;
  totalLength: number;
  segments: BreaklineSegment[];
}

export interface TinPrepBreakline {
  name: string;
  type: 'hard' | 'soft' | 'boundary';
  layer?: string;
  vertices: { pointNumber: string; easting: number; northing: number; elevation: number }[];
  length: number;
}

export interface TinPrepData {
  version: string;
  generatedAt: string;
  projectName: string;
  crs: { epsg: number; name: string; datum: string };
  massPoints: { pointNumber: string; easting: number; northing: number; elevation: number; code?: string }[];
  breaklines: TinPrepBreakline[];
  boundary?: TinPrepBreakline;
  stats: {
    massPointCount: number;
    breaklineCount: number;
    totalBreaklineVertices: number;
    totalBreaklineLength: number;
    surveyAreaBbox: { minX: number; maxX: number; minY: number; maxY: number };
    pointDensityPerSqm: number;
  };
}

/**
 * Validate a breakline and compute segments.
 */
export function validateBreakline(
  points: { pointNumber: string; easting?: number; northing?: number; elevation?: number }[]
): BreaklineValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (points.length < 2) {
    errors.push('Breakline must have at least 2 points.');
  }

  // Check for missing coordinates
  const missingCoords = points.filter(p => p.easting == null || p.northing == null);
  if (missingCoords.length > 0) {
    errors.push(
      `${missingCoords.length} point(s) missing coordinates: ${missingCoords.map(p => p.pointNumber).join(', ')}`
    );
  }

  // Check for duplicate consecutive points
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (
      prev.easting === curr.easting &&
      prev.northing === curr.northing &&
      prev.pointNumber === curr.pointNumber
    ) {
      warnings.push(`Duplicate consecutive point: ${curr.pointNumber} at position ${i + 1}`);
    }
  }

  // Compute segments
  const segments: BreaklineSegment[] = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (
      prev.easting == null || prev.northing == null ||
      curr.easting == null || curr.northing == null
    ) {
      continue;
    }
    const { distance } = computeBearingDistance(
      prev.easting, prev.northing, curr.easting, curr.northing
    );
    totalLength += distance;
    const elevDiff = (curr.elevation ?? 0) - (prev.elevation ?? 0);
    const slope = distance > 0 ? (elevDiff / distance) * 100 : 0; // percent
    segments.push({
      fromPoint: prev.pointNumber,
      toPoint: curr.pointNumber,
      from: { easting: prev.easting, northing: prev.northing, elevation: prev.elevation },
      to: { easting: curr.easting, northing: curr.northing, elevation: curr.elevation },
      length: distance,
      slope,
    });
  }

  // Check for self-intersection (simple O(n²) check — fine for field-size breaklines)
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 2; j < segments.length; j++) {
      if (segmentsIntersect(segments[i], segments[j])) {
        warnings.push(`Possible self-intersection between segments ${i + 1} and ${j + 1}`);
      }
    }
  }

  // Warn on long segments (suggests missing detail)
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].length > 50) {
      warnings.push(`Segment ${i + 1} is long (${segments[i].length.toFixed(1)}m) — consider adding intermediate points`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    pointCount: points.length,
    segmentCount: segments.length,
    totalLength,
    segments,
  };
}

/**
 * Check if two breakline segments intersect.
 * Uses the standard cross-product intersection test.
 */
function segmentsIntersect(s1: BreaklineSegment, s2: BreaklineSegment): boolean {
  const d1 = direction(s2.from, s2.to, s1.from);
  const d2 = direction(s2.from, s2.to, s1.to);
  const d3 = direction(s1.from, s1.to, s2.from);
  const d4 = direction(s1.from, s1.to, s2.to);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function direction(a: Point2D, b: Point2D, c: Point2D): number {
  return (c.easting - a.easting) * (b.northing - a.northing) -
         (b.easting - a.easting) * (c.northing - a.northing);
}

/**
 * Compute the bounding box and area of a set of points.
 */
export function computeBbox(points: Point2D[]): {
  minX: number; maxX: number; minY: number; maxY: number;
  area: number; // in square meters (assuming projected CRS)
} {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, area: 0 };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.easting < minX) minX = p.easting;
    if (p.easting > maxX) maxX = p.easting;
    if (p.northing < minY) minY = p.northing;
    if (p.northing > maxY) maxY = p.northing;
  }
  const area = (maxX - minX) * (maxY - minY);
  return { minX, maxX, minY, maxY, area };
}

/**
 * Compute point density per square kilometer.
 */
export function computePointDensity(
  pointCount: number,
  bboxArea: number
): number {
  if (bboxArea === 0) return 0;
  return pointCount / (bboxArea / 1_000_000); // points per km²
}

/**
 * Build the TIN-prep JSON payload for desktop consumption.
 * This is the shape the desktop's TIN engine expects.
 */
export function buildTinPrepData(input: {
  projectName: string;
  crsEpsg: number;
  crsName?: string;
  crsDatum?: string;
  massPoints: { pointNumber: string; easting: number; northing: number; elevation: number; code?: string }[];
  breaklines: TinPrepBreakline[];
  boundary?: TinPrepBreakline;
}): TinPrepData {
  const allPoints = [
    ...input.massPoints,
    ...input.breaklines.flatMap(bl => bl.vertices),
    ...(input.boundary?.vertices ?? []),
  ];
  const bbox = computeBbox(allPoints.map(p => ({ easting: p.easting, northing: p.northing })));
  const totalBreaklineVertices = input.breaklines.reduce((s, bl) => s + bl.vertices.length, 0);
  const totalBreaklineLength = input.breaklines.reduce((s, bl) => s + bl.length, 0);
  const density = computePointDensity(allPoints.length, bbox.area);

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    projectName: input.projectName,
    crs: {
      epsg: input.crsEpsg,
      name: input.crsName ?? `EPSG:${input.crsEpsg}`,
      datum: input.crsDatum ?? 'ARC1960',
    },
    massPoints: input.massPoints,
    breaklines: input.breaklines,
    boundary: input.boundary,
    stats: {
      massPointCount: input.massPoints.length,
      breaklineCount: input.breaklines.length,
      totalBreaklineVertices,
      totalBreaklineLength,
      surveyAreaBbox: { minX: bbox.minX, maxX: bbox.maxX, minY: bbox.minY, maxY: bbox.maxY },
      pointDensityPerSqm: density,
    },
  };
}

/**
 * Coverage quality assessment — flags gaps in field data capture.
 */
export interface CoverageAssessment {
  pointCount: number;
  bboxArea: number;
  densityPerSqKm: number;
  breaklineCount: number;
  hasBoundary: boolean;
  issues: string[];
  recommendations: string[];
}

export function assessCoverage(
  massPoints: Point2D[],
  breaklines: TinPrepBreakline[],
  hasBoundary: boolean
): CoverageAssessment {
  const issues: string[] = [];
  const recommendations: string[] = [];

  const bbox = computeBbox(massPoints);
  const density = computePointDensity(massPoints.length, bbox.area);

  if (massPoints.length < 10) {
    issues.push(`Only ${massPoints.length} mass points captured — minimum 10 recommended for any meaningful surface.`);
    recommendations.push('Continue capturing mass points across the survey area.');
  }

  if (density < 100 && massPoints.length > 0) {
    issues.push(`Point density is low (${density.toFixed(0)}/km²) — typical topo survey needs 500-2000/km².`);
    recommendations.push('Add more mass points in sparse areas, especially around features of interest.');
  }

  if (breaklines.length === 0) {
    issues.push('No breaklines captured — TIN will not represent ridges, valleys, or edges correctly.');
    recommendations.push('Capture breaklines along ridges, road edges, water courses, and building footprints.');
  }

  if (!hasBoundary) {
    issues.push('No survey boundary defined — TIN will extrapolate beyond survey area.');
    recommendations.push('Capture a boundary breakline around the perimeter of the survey area.');
  }

  const hardBreaklines = breaklines.filter(b => b.type === 'hard');
  if (hardBreaklines.length === 0 && breaklines.length > 0) {
    issues.push('No hard breaklines — man-made features (roads, walls) should be captured as hard breaklines.');
    recommendations.push('Capture road edges and building footprints as hard breaklines for sharp TIN edges.');
  }

  // Check for very long breaklines (potential missed detail)
  const longBreaklines = breaklines.filter(b => b.length > 200);
  if (longBreaklines.length > 0) {
    issues.push(`${longBreaklines.length} breakline(s) exceed 200m — may need intermediate points.`);
    recommendations.push(`Review: ${longBreaklines.map(b => b.name).join(', ')}`);
  }

  return {
    pointCount: massPoints.length,
    bboxArea: bbox.area,
    densityPerSqKm: density,
    breaklineCount: breaklines.length,
    hasBoundary,
    issues,
    recommendations,
  };
}
