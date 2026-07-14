/**
 * @metardu/engine — Curve geometry (for road design in engineering surveys)
 */

import { bearingDistance, type Point2D } from './cogo';

const DEG2RAD = Math.PI / 180;

export interface HorizontalCurve {
  PI: Point2D;              // Point of Intersection
  backTangentBearing: number;
  forwardTangentBearing: number;
  radius: number;
  deflectionAngle: number;  // degrees
  tangentLength: number;
  arcLength: number;
  chordLength: number;
  degreeOfCurve: number;    // arc definition (degrees per 30m)
  PC: Point2D;              // Point of Curve (start)
  PT: Point2D;              // Point of Tangent (end)
  midOrdinate: number;
  externalDistance: number;
}

/**
 * Compute a horizontal curve from PI, tangent bearings, and radius.
 */
export function horizontalCurve(
  PI: Point2D,
  backTangentBearing: number,
  forwardTangentBearing: number,
  radius: number
): HorizontalCurve {
  // Deflection angle (intersection angle)
  let deflectionAngle = forwardTangentBearing - backTangentBearing;
  if (deflectionAngle < 0) deflectionAngle += 360;
  if (deflectionAngle > 180) deflectionAngle = 360 - deflectionAngle;

  const defRad = deflectionAngle * DEG2RAD;
  const halfDef = defRad / 2;

  const tangentLength = radius * Math.tan(halfDef);
  const arcLength = radius * defRad;
  const chordLength = 2 * radius * Math.sin(halfDef);
  const degreeOfCurve = (1800) / (Math.PI * radius); // degrees per 30m arc
  const midOrdinate = radius * (1 - Math.cos(halfDef));
  const externalDistance = radius * (Math.cos(halfDef) ** -1 - 1); // = radius / cos(halfDef) - radius

  // PC is back along the back tangent from PI
  const PC = bearingDistance(PI, (backTangentBearing + 180) % 360, tangentLength);
  // PT is forward along the forward tangent from PI
  const PT = bearingDistance(PI, forwardTangentBearing, tangentLength);

  return {
    PI,
    backTangentBearing,
    forwardTangentBearing,
    radius,
    deflectionAngle,
    tangentLength,
    arcLength,
    chordLength,
    degreeOfCurve,
    PC,
    PT,
    midOrdinate,
    externalDistance,
  };
}

/**
 * Compute deflection angles for setting out a curve by chord method.
 * Returns deflection angles (from PC) for each station at a given interval.
 */
export function curveDeflections(
  curve: HorizontalCurve,
  stationInterval: number = 10
): { station: number; deflectionAngle: number; chordLength: number }[] {
  const stations: { station: number; deflectionAngle: number; chordLength: number }[] = [];
  const totalStations = Math.ceil(curve.arcLength / stationInterval);
  let cumulative = 0;

  for (let i = 0; i <= totalStations; i++) {
    const arc = Math.min(i * stationInterval, curve.arcLength);
    const angleFromPC = arc / curve.radius; // radians
    const deflection = (angleFromPC / 2) * (180 / Math.PI); // degrees
    const chord = 2 * curve.radius * Math.sin(angleFromPC / 2);
    stations.push({
      station: arc,
      deflectionAngle: deflection,
      chordLength: chord,
    });
    cumulative = arc;
    if (arc >= curve.arcLength) break;
  }

  return stations;
}

/**
 * Vertical curve (parabolic) — for road profile design.
 */
export interface VerticalCurve {
  PVC: { station: number; elevation: number };  // Point of Vertical Curve
  PVT: { station: number; elevation: number };  // Point of Vertical Tangent
  PVI: { station: number; elevation: number };  // Point of Vertical Intersection
  length: number;
  g1: number;  // grade in (%)
  g2: number;  // grade out (%)
  kValue: number;
}

export function verticalCurve(
  pviStation: number,
  pviElevation: number,
  g1: number,
  g2: number,
  length: number
): VerticalCurve {
  const halfLength = length / 2;
  const PVC = { station: pviStation - halfLength, elevation: pviElevation - g1 * halfLength / 100 };
  const PVT = { station: pviStation + halfLength, elevation: pviElevation + g2 * halfLength / 100 };
  const kValue = length / Math.abs(g2 - g1);
  return { PVC, PVT, PVI: { station: pviStation, elevation: pviElevation }, length, g1, g2, kValue };
}

/**
 * Compute elevation at any station along a vertical curve.
 */
export function elevationOnVerticalCurve(
  curve: VerticalCurve,
  station: number
): number {
  const x = station - curve.PVC.station;
  if (x < 0 || x > curve.length) {
    // Outside curve — use tangent grade
    if (x < 0) {
      return curve.PVC.elevation + (curve.g1 / 100) * x;
    }
    return curve.PVT.elevation + (curve.g2 / 100) * (x - curve.length);
  }
  // On curve: y = y_PVC + g1*x + ((g2-g1)/(2L)) * x^2
  const r = (curve.g2 - curve.g1) / (2 * curve.length);
  return curve.PVC.elevation + (curve.g1 / 100) * x + r * x * x / 100;
}
