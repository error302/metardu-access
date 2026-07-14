/**
 * @metardu/engine — Traverse adjustment tests
 */

import {
  computeDeltas,
  computeBearingDistance,
  bowditchAdjust,
  meanFaceObservations,
} from '../../packages/engine/src/traverse';

describe('computeDeltas', () => {
  it('computes delta N and E for due north', () => {
    const result = computeDeltas(0, 100);
    expect(result.deltaN).toBeCloseTo(100, 5);
    expect(result.deltaE).toBeCloseTo(0, 5);
  });

  it('computes delta N and E for due east', () => {
    const result = computeDeltas(90, 100);
    expect(result.deltaN).toBeCloseTo(0, 5);
    expect(result.deltaE).toBeCloseTo(100, 5);
  });

  it('computes delta N and E for southeast (135°)', () => {
    const result = computeDeltas(135, 100);
    expect(result.deltaN).toBeCloseTo(-70.7107, 3);
    expect(result.deltaE).toBeCloseTo(70.7107, 3);
  });
});

describe('computeBearingDistance', () => {
  it('returns bearing 90° for due east movement', () => {
    const result = computeBearingDistance(0, 0, 100, 0);
    expect(result.bearing).toBeCloseTo(90, 5);
    expect(result.distance).toBeCloseTo(100, 5);
  });

  it('returns bearing 180° for due south movement', () => {
    const result = computeBearingDistance(0, 0, 0, -100);
    expect(result.bearing).toBeCloseTo(180, 5);
    expect(result.distance).toBeCloseTo(100, 5);
  });

  it('returns bearing 0° for due north movement', () => {
    const result = computeBearingDistance(0, 0, 0, 100);
    expect(result.bearing).toBeCloseTo(0, 5);
  });
});

describe('bowditchAdjust', () => {
  it('returns zero misclosure for a perfectly closed traverse', () => {
    // Square traverse: 4 legs of 100m at 0°, 90°, 180°, 270°
    const legs = [
      { fromPoint: 'A', toPoint: 'B', distance: 100, bearing: 90 },
      { fromPoint: 'B', toPoint: 'C', distance: 100, bearing: 180 },
      { fromPoint: 'C', toPoint: 'D', distance: 100, bearing: 270 },
      { fromPoint: 'D', toPoint: 'A', distance: 100, bearing: 0 },
    ];
    const result = bowditchAdjust(legs, { easting: 1000, northing: 1000 });
    expect(result.linearMisclosure).toBeLessThan(1e-9);
    expect(result.perimeter).toBeCloseTo(400, 5);
    expect(result.precisionPasses).toBe(true);
  });

  it('detects misclosure in an open traverse', () => {
    const legs = [
      { fromPoint: 'A', toPoint: 'B', distance: 100, bearing: 90 },
      { fromPoint: 'B', toPoint: 'C', distance: 100, bearing: 180 },
    ];
    const result = bowditchAdjust(
      legs,
      { easting: 0, northing: 0 },
      { easting: 100, northing: -100 }
    );
    expect(result.linearMisclosure).toBeGreaterThan(0);
  });

  it('computes adjusted coordinates', () => {
    const legs = [
      { fromPoint: 'A', toPoint: 'B', distance: 100, bearing: 90 },
    ];
    const result = bowditchAdjust(legs, { easting: 0, northing: 0 });
    expect(result.adjustedCoordinates['A']).toEqual({ easting: 0, northing: 0 });
    expect(result.adjustedCoordinates['B'].easting).toBeCloseTo(100, 5);
    expect(result.adjustedCoordinates['B'].northing).toBeCloseTo(0, 5);
  });
});

describe('meanFaceObservations', () => {
  it('averages face left and face right readings', () => {
    const observations = [
      {
        id: '1',
        fromPoint: 'A',
        toPoint: 'B',
        rawHorizontalAngle: 30,
        rawVerticalAngle: 90,
        rawSlopeDistance: 50,
        face: 'left' as const,
        timestamp: '',
      },
      {
        id: '2',
        fromPoint: 'A',
        toPoint: 'B',
        rawHorizontalAngle: 210, // 30 + 180
        rawVerticalAngle: 270, // 360 - 90
        rawSlopeDistance: 50,
        face: 'right' as const,
        timestamp: '',
      },
    ];
    const result = meanFaceObservations(observations);
    expect(result.meanSlopeDistance).toBeCloseTo(50, 5);
  });

  it('returns empty for no observations', () => {
    const result = meanFaceObservations([]);
    expect(result).toEqual({});
  });
});
