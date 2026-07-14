/**
 * @metardu/engine — COGO tests
 */

import {
  bearingDistance,
  lineLineIntersection,
  distanceDistanceIntersection,
  polygonArea,
  polygonPerimeter,
  slopeToHorizontal,
  applyEdmCorrections,
} from '../../packages/engine/src/cogo';

describe('bearingDistance', () => {
  it('computes a point at bearing 90° (east) and distance 100', () => {
    const result = bearingDistance({ easting: 0, northing: 0 }, 90, 100);
    expect(result.easting).toBeCloseTo(100, 5);
    expect(result.northing).toBeCloseTo(0, 5);
  });

  it('computes a point at bearing 0° (north) and distance 100', () => {
    const result = bearingDistance({ easting: 0, northing: 0 }, 0, 100);
    expect(result.easting).toBeCloseTo(0, 5);
    expect(result.northing).toBeCloseTo(100, 5);
  });
});

describe('lineLineIntersection', () => {
  it('finds intersection of perpendicular lines', () => {
    // Line 1: from origin, bearing 90° (east)
    // Line 2: from (50, -50), bearing 0° (north)
    const result = lineLineIntersection(
      { easting: 0, northing: 0 },
      90,
      { easting: 50, northing: -50 },
      0
    );
    expect(result).not.toBeNull();
    expect(result!.easting).toBeCloseTo(50, 5);
    expect(result!.northing).toBeCloseTo(0, 5);
  });

  it('returns null for parallel lines', () => {
    const result = lineLineIntersection(
      { easting: 0, northing: 0 },
      90,
      { easting: 0, northing: 10 },
      90
    );
    expect(result).toBeNull();
  });
});

describe('distanceDistanceIntersection', () => {
  it('finds two intersection points for two circles', () => {
    // Two circles 100m apart, both radius 100m
    const result = distanceDistanceIntersection(
      { easting: 0, northing: 0 },
      100,
      { easting: 100, northing: 0 },
      100
    );
    expect(result.length).toBe(2);
    const [p1, p2] = result as [{ easting: number; northing: number }, { easting: number; northing: number }];
    // Both points should be at easting ~50
    expect(p1.easting).toBeCloseTo(50, 0);
    expect(p2.easting).toBeCloseTo(50, 0);
    // One should be above, one below the x-axis
    expect(p1.northing + p2.northing).toBeCloseTo(0, 5);
  });

  it('returns empty when circles do not intersect', () => {
    const result = distanceDistanceIntersection(
      { easting: 0, northing: 0 },
      10,
      { easting: 100, northing: 0 },
      10
    );
    expect(result.length).toBe(0);
  });
});

describe('polygonArea', () => {
  it('computes area of a 100x100 square', () => {
    const square = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ];
    expect(polygonArea(square)).toBeCloseTo(10000, 5);
  });

  it('returns 0 for less than 3 points', () => {
    expect(polygonArea([{ easting: 0, northing: 0 }])).toBe(0);
  });
});

describe('polygonPerimeter', () => {
  it('computes perimeter of a 100x100 square', () => {
    const square = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 100 },
      { easting: 0, northing: 100 },
    ];
    expect(polygonPerimeter(square)).toBeCloseTo(400, 5);
  });
});

describe('slopeToHorizontal', () => {
  it('returns slope distance for vertical angle 0° (horizontal)', () => {
    expect(slopeToHorizontal(100, 0)).toBeCloseTo(100, 5);
  });

  it('returns 0 for vertical angle 90° (straight up)', () => {
    expect(slopeToHorizontal(100, 90)).toBeCloseTo(0, 5);
  });
});

describe('applyEdmCorrections', () => {
  it('returns same distance at standard conditions', () => {
    const corrected = applyEdmCorrections(100, 15, 1013.25);
    expect(corrected).toBeCloseTo(100, 5);
  });
});
