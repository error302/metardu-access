/**
 * @metardu/engine — Traverse adjustment (Bowditch / Transit)
 * Ported from metardu web's src/lib/engine/traverse.ts
 *
 * Bowditch (Compass) rule: distributes linear misclosure proportionally to leg length.
 * Transit rule: distributes proportionally to latitudes and departures.
 */

import type { Observation } from './types';

export interface TraverseLeg {
  fromPoint: string;
  toPoint: string;
  distance: number; // meters
  bearing: number; // degrees, 0-360
}

export interface TraverseAdjustmentResult {
  legs: AdjustedLeg[];
  perimeter: number;
  linearMisclosure: number;
  angularMisclosure: number;
  precisionRatio: string; // '1:5000'
  precisionPasses: boolean;
  adjustedCoordinates: Record<string, { easting: number; northing: number }>;
  correctionsLog: Record<string, unknown>;
}

export interface AdjustedLeg extends TraverseLeg {
  adjustedBearing: number;
  correctedDistance: number;
  deltaEasting: number;
  deltaNorthing: number;
  correctionEasting: number;
  correctionNorthing: number;
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Compute latitudes and departures from bearing + distance.
 * Bearing is measured clockwise from north.
 */
export function computeDeltas(bearingDeg: number, distance: number): {
  deltaN: number;
  deltaE: number;
} {
  const br = bearingDeg * DEG2RAD;
  return {
    deltaN: distance * Math.cos(br),
    deltaE: distance * Math.sin(br),
  };
}

/**
 * Compute bearing and distance between two coordinates.
 */
export function computeBearingDistance(
  fromE: number,
  fromN: number,
  toE: number,
  toN: number
): { bearing: number; distance: number } {
  const dE = toE - fromE;
  const dN = toN - fromN;
  const distance = Math.sqrt(dE * dE + dN * dN);
  let bearing = Math.atan2(dE, dN) * RAD2DEG;
  if (bearing < 0) bearing += 360;
  return { bearing, distance };
}

/**
 * Adjust a traverse using the Bowditch (Compass) rule.
 * @param legs - Traverse legs with measured bearings and distances
 * @param startCoords - Starting point coordinates
 * @param closingCoords - Optional closing point (for closed traverses)
 * @param expectedAngularClosure - Expected angular closure in degrees (e.g., (n-2)*180 for closed polygon)
 */
export function bowditchAdjust(
  legs: TraverseLeg[],
  startCoords: { easting: number; northing: number },
  closingCoords?: { easting: number; northing: number },
  expectedAngularClosure?: number
): TraverseAdjustmentResult {
  const correctionsLog: Record<string, unknown> = {
    method: 'bowditch',
    legCount: legs.length,
  };

  // Compute angular misclosure (if closed)
  let angularMisclosure = 0;
  if (expectedAngularClosure !== undefined) {
    const measuredSum = legs.reduce((sum, leg, i) => {
      if (i === 0) return leg.bearing;
      const prev = legs[i - 1].bearing;
      const interior = (leg.bearing - prev + 180 + 360) % 360;
      return sum + interior;
    }, 0);
    angularMisclosure = measuredSum - expectedAngularClosure;
    correctionsLog.angularClosure = {
      expected: expectedAngularClosure,
      measured: measuredSum,
      misclosure: angularMisclosure,
    };
  }

  // Compute raw deltas and perimeter
  let perimeter = 0;
  const rawDeltas = legs.map((leg) => {
    perimeter += leg.distance;
    return computeDeltas(leg.bearing, leg.distance);
  });

  // Sum latitudes and departures
  const sumDeltaN = rawDeltas.reduce((s, d) => s + d.deltaN, 0);
  const sumDeltaE = rawDeltas.reduce((s, d) => s + d.deltaE, 0);

  // Misclosure
  let misclosureE = sumDeltaE;
  let misclosureN = sumDeltaN;
  if (closingCoords) {
    misclosureE = sumDeltaE - (closingCoords.easting - startCoords.easting);
    misclosureN = sumDeltaN - (closingCoords.northing - startCoords.northing);
  }
  const linearMisclosure = Math.sqrt(misclosureE ** 2 + misclosureN ** 2);

  // Precision ratio
  const precisionDenominator = linearMisclosure > 0 ? Math.floor(perimeter / linearMisclosure) : Infinity;
  const precisionRatio = linearMisclosure > 0 ? `1:${precisionDenominator}` : '1:∞';
  const precisionPasses = precisionDenominator >= 5000; // Kenya 3rd order minimum

  // Apply Bowditch corrections (proportional to leg length)
  const adjustedLegs: AdjustedLeg[] = legs.map((leg, i) => {
    const correctionE = perimeter > 0 ? (-misclosureE * leg.distance) / perimeter : 0;
    const correctionN = perimeter > 0 ? (-misclosureN * leg.distance) / perimeter : 0;
    return {
      ...leg,
      adjustedBearing: leg.bearing, // Bowditch doesn't change bearing
      correctedDistance: leg.distance,
      deltaEasting: rawDeltas[i].deltaE + correctionE,
      deltaNorthing: rawDeltas[i].deltaN + correctionN,
      correctionEasting: correctionE,
      correctionNorthing: correctionN,
    };
  });

  // Compute adjusted coordinates
  const adjustedCoordinates: Record<string, { easting: number; northing: number }> = {};
  let currentE = startCoords.easting;
  let currentN = startCoords.northing;
  adjustedCoordinates[legs[0].fromPoint] = { easting: currentE, northing: currentN };
  for (const leg of adjustedLegs) {
    currentE += leg.deltaEasting;
    currentN += leg.deltaNorthing;
    adjustedCoordinates[leg.toPoint] = { easting: currentE, northing: currentN };
  }

  correctionsLog.linearClosure = {
    sumDeltaE,
    sumDeltaN,
    misclosureE,
    misclosureN,
    linearMisclosure,
    perimeter,
    precisionRatio,
  };

  return {
    legs: adjustedLegs,
    perimeter,
    linearMisclosure,
    angularMisclosure,
    precisionRatio,
    precisionPasses,
    adjustedCoordinates,
    correctionsLog,
  };
}

/**
 * Convert a series of face-left / face-right observations into mean angles.
 */
export function meanFaceObservations(observations: Observation[]): {
  meanHorizontalAngle?: number;
  meanVerticalAngle?: number;
  meanSlopeDistance?: number;
} {
  const faceLeft = observations.filter((o) => o.face === 'left');
  const faceRight = observations.filter((o) => o.face === 'right');

  if (faceLeft.length === 0 && faceRight.length === 0) return {};

  const meanHA =
    faceLeft.length > 0 && faceRight.length > 0
      ? ((faceLeft[0].rawHorizontalAngle ?? 0) + (faceRight[0].rawHorizontalAngle ?? 0) + 180) / 2 % 360
      : (faceLeft[0]?.rawHorizontalAngle ?? faceRight[0]?.rawHorizontalAngle);
  const meanVA =
    faceLeft.length > 0 && faceRight.length > 0
      ? ((faceLeft[0].rawVerticalAngle ?? 0) + (360 - (faceRight[0].rawVerticalAngle ?? 0))) / 2
      : (faceLeft[0]?.rawVerticalAngle ?? faceRight[0]?.rawVerticalAngle);
  const meanSD =
    faceLeft.length > 0 && faceRight.length > 0
      ? ((faceLeft[0].rawSlopeDistance ?? 0) + (faceRight[0].rawSlopeDistance ?? 0)) / 2
      : (faceLeft[0]?.rawSlopeDistance ?? faceRight[0]?.rawSlopeDistance);

  return {
    meanHorizontalAngle: meanHA,
    meanVerticalAngle: meanVA,
    meanSlopeDistance: meanSD,
  };
}
