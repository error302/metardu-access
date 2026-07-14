/**
 * @metardu/engine — Coordinate geometry (COGO) primitives
 */

import { computeBearingDistance } from './traverse';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface Point2D {
  easting: number;
  northing: number;
}

export interface Point3D extends Point2D {
  elevation: number;
}

/**
 * Bearing-distance intersection: compute a point at given bearing + distance from origin.
 */
export function bearingDistance(
  origin: Point2D,
  bearingDeg: number,
  distance: number
): Point2D {
  const br = bearingDeg * DEG2RAD;
  return {
    easting: origin.easting + distance * Math.sin(br),
    northing: origin.northing + distance * Math.cos(br),
  };
}

/**
 * Two-line intersection: find the intersection point of two lines defined by
 * a point and a bearing each.
 */
export function lineLineIntersection(
  p1: Point2D,
  bearing1: number,
  p2: Point2D,
  bearing2: number
): Point2D | null {
  const b1 = bearing1 * DEG2RAD;
  const b2 = bearing2 * DEG2RAD;

  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;

  const det = Math.sin(b2) * Math.cos(b1) - Math.sin(b1) * Math.cos(b2);
  if (Math.abs(det) < 1e-10) return null; // parallel

  const t = (dx * Math.cos(b2) - dy * Math.sin(b2)) / det;
  return {
    easting: p1.easting + t * Math.sin(b1),
    northing: p1.northing + t * Math.cos(b1),
  };
}

/**
 * Distance-distance intersection: find up to two points at given distances from two centers.
 */
export function distanceDistanceIntersection(
  center1: Point2D,
  dist1: number,
  center2: Point2D,
  dist2: number
): [Point2D, Point2D] | [Point2D] | [] {
  const { distance: d, bearing } = computeBearingDistance(
    center1.easting,
    center1.northing,
    center2.easting,
    center2.northing
  );

  if (d > dist1 + dist2 || d < Math.abs(dist1 - dist2) || d === 0) return [];

  const a = (dist1 * dist1 - dist2 * dist2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, dist1 * dist1 - a * a));

  const p = bearingDistance(center1, bearing, a);
  const perpBearing1 = (bearing + 90) % 360;
  const perpBearing2 = (bearing + 270) % 360;

  if (h < 1e-6) return [p];

  return [
    bearingDistance(p, perpBearing1, h),
    bearingDistance(p, perpBearing2, h),
  ];
}

/**
 * Compute polygon area using the Shoelace formula.
 */
export function polygonArea(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].easting * points[j].northing;
    area -= points[j].easting * points[i].northing;
  }
  return Math.abs(area / 2);
}

/**
 * Compute polygon perimeter.
 */
export function polygonPerimeter(points: Point2D[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    const dx = points[j].easting - points[i].easting;
    const dy = points[j].northing - points[i].northing;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

/**
 * Curve geometry: compute curve parameters from two tangents.
 */
export interface CurveParameters {
  radius: number;
  arcLength: number;
  chordLength: number;
  tangentLength: number;
  deflectionAngle: number; // degrees
  degreeOfCurve: number; // arc definition, degrees per 30m
}

export function curveFromTangents(
  PI: Point2D,
  backTangentBearing: number,
  forwardTangentBearing: number,
  radius: number
): CurveParameters & { PC: Point2D; PT: Point2D } {
  let deflectionAngle = Math.abs(forwardTangentBearing - backTangentBearing);
  if (deflectionAngle > 180) deflectionAngle = 360 - deflectionAngle;

  const defRad = deflectionAngle * DEG2RAD;
  const tangentLength = radius * Math.tan(defRad / 2);
  const arcLength = radius * defRad;
  const chordLength = 2 * radius * Math.sin(defRad / 2);
  const degreeOfCurve = (30 * 180) / (Math.PI * radius); // arc definition, 30m chord

  const PC = bearingDistance(PI, (backTangentBearing + 180) % 360, tangentLength);
  const PT = bearingDistance(PI, forwardTangentBearing, tangentLength);

  return {
    radius,
    arcLength,
    chordLength,
    tangentLength,
    deflectionAngle,
    degreeOfCurve,
    PC,
    PT,
  };
}

/**
 * Convert slope distance to horizontal distance.
 */
export function slopeToHorizontal(slopeDistance: number, verticalAngleDeg: number): number {
  return slopeDistance * Math.cos(verticalAngleDeg * DEG2RAD);
}

/**
 * Convert horizontal + vertical angle to slope distance.
 */
export function horizontalToSlope(horizontalDistance: number, verticalAngleDeg: number): number {
  return horizontalDistance / Math.cos(verticalAngleDeg * DEG2RAD);
}

/**
 * Apply EDM meteorological corrections.
 * @param distance - measured slope distance (m)
 * @param tempC - temperature (°C)
 * @param pressurehPa - atmospheric pressure (hPa)
 * @param ppmSetting - instrument ppm setting
 * @returns corrected distance (m)
 */
export function applyEdmCorrections(
  distance: number,
  tempC: number,
  pressurehPa: number,
  ppmSetting: number = 0
): number {
  // Standard: 15°C, 1013.25 hPa
  const standardTemp = 15;
  const standardPressure = 1013.25;
  // ppm correction (simplified)
  const ppm =
    ((pressurehPa - standardPressure) / (standardPressure * 0.001) -
      (tempC - standardTemp) / (273.15 + standardTemp)) *
      0.001 +
    ppmSetting * 0.000001;
  return distance * (1 + ppm);
}
