/**
 * @metardu/engine — Breakline validation and TIN prep tests
 */

import {
  validateBreakline,
  computeBbox,
  computePointDensity,
  buildTinPrepData,
  assessCoverage,
} from '../../packages/engine/src/breaklines';

describe('validateBreakline', () => {
  it('returns valid for a 2-point breakline with coordinates', () => {
    const result = validateBreakline([
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
      { pointNumber: 'B', easting: 100, northing: 0, elevation: 102 },
    ]);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.pointCount).toBe(2);
    expect(result.segmentCount).toBe(1);
    expect(result.totalLength).toBeCloseTo(100, 1);
  });

  it('flags breaklines with fewer than 2 points', () => {
    const result = validateBreakline([
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('at least 2 points');
  });

  it('flags points missing coordinates', () => {
    const result = validateBreakline([
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
      { pointNumber: 'B', easting: undefined, northing: undefined, elevation: 102 },
    ]);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('missing coordinates');
  });

  it('warns on duplicate consecutive points', () => {
    const result = validateBreakline([
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
      { pointNumber: 'B', easting: 100, northing: 0, elevation: 102 },
    ]);
    expect(result.warnings.some(w => w.includes('Duplicate consecutive point'))).toBe(true);
  });

  it('warns on long segments (over 50m)', () => {
    const result = validateBreakline([
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
      { pointNumber: 'B', easting: 100, northing: 0, elevation: 102 },
    ]);
    expect(result.warnings.some(w => w.includes('long'))).toBe(true);
  });

  it('computes total length correctly for multi-segment breakline', () => {
    const result = validateBreakline([
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
      { pointNumber: 'B', easting: 30, northing: 0, elevation: 101 },
      { pointNumber: 'C', easting: 30, northing: 40, elevation: 102 },
    ]);
    // A->B = 30m, B->C = 40m, total = 70m (3-4-5 triangle)
    expect(result.totalLength).toBeCloseTo(70, 1);
    expect(result.segmentCount).toBe(2);
  });

  it('computes slope correctly', () => {
    const result = validateBreakline([
      { pointNumber: 'A', easting: 0, northing: 0, elevation: 100 },
      { pointNumber: 'B', easting: 100, northing: 0, elevation: 110 },
    ]);
    // 10m elev gain over 100m distance = 10% slope
    expect(result.segments[0].slope).toBeCloseTo(10, 2);
  });
});

describe('computeBbox', () => {
  it('computes bounding box for a set of points', () => {
    const points = [
      { easting: 100, northing: 200 },
      { easting: 300, northing: 400 },
      { easting: 150, northing: 100 },
      { easting: 250, northing: 350 },
    ];
    const bbox = computeBbox(points);
    expect(bbox.minX).toBe(100);
    expect(bbox.maxX).toBe(300);
    expect(bbox.minY).toBe(100);
    expect(bbox.maxY).toBe(400);
    expect(bbox.area).toBe(200 * 300); // 60000 m²
  });

  it('returns zeros for empty point set', () => {
    const bbox = computeBbox([]);
    expect(bbox.area).toBe(0);
  });
});

describe('computePointDensity', () => {
  it('computes points per square kilometer', () => {
    // 100 points in 1 km² (1,000,000 m²)
    const density = computePointDensity(100, 1_000_000);
    expect(density).toBe(100);
  });

  it('returns 0 for zero area', () => {
    expect(computePointDensity(100, 0)).toBe(0);
  });

  it('handles high density correctly', () => {
    // 1000 points in 0.1 km² (100,000 m²)
    const density = computePointDensity(1000, 100_000);
    expect(density).toBe(10000);
  });
});

describe('buildTinPrepData', () => {
  it('builds TIN prep JSON with correct stats', () => {
    const data = buildTinPrepData({
      projectName: 'Test Project',
      crsEpsg: 21037,
      massPoints: [
        { pointNumber: 'P1', easting: 100, northing: 100, elevation: 50 },
        { pointNumber: 'P2', easting: 200, northing: 100, elevation: 52 },
        { pointNumber: 'P3', easting: 150, northing: 200, elevation: 51 },
      ],
      breaklines: [
        {
          name: 'Ridge',
          type: 'soft',
          vertices: [
            { pointNumber: 'R1', easting: 100, northing: 100, elevation: 50 },
            { pointNumber: 'R2', easting: 200, northing: 100, elevation: 52 },
          ],
          length: 100,
        },
      ],
    });

    expect(data.version).toBe('1.0');
    expect(data.crs.epsg).toBe(21037);
    expect(data.stats.massPointCount).toBe(3);
    expect(data.stats.breaklineCount).toBe(1);
    expect(data.stats.totalBreaklineVertices).toBe(2);
    expect(data.stats.totalBreaklineLength).toBe(100);
    expect(data.stats.surveyAreaBbox.minX).toBe(100);
    expect(data.stats.surveyAreaBbox.maxX).toBe(200);
    expect(data.stats.surveyAreaBbox.minY).toBe(100);
    expect(data.stats.surveyAreaBbox.maxY).toBe(200);
  });

  it('includes boundary in TIN prep data when provided', () => {
    const data = buildTinPrepData({
      projectName: 'Test',
      crsEpsg: 21037,
      massPoints: [],
      breaklines: [],
      boundary: {
        name: 'Survey Boundary',
        type: 'boundary',
        vertices: [],
        length: 500,
      },
    });
    expect(data.boundary).toBeDefined();
    expect(data.boundary?.name).toBe('Survey Boundary');
  });
});

describe('assessCoverage', () => {
  it('flags insufficient mass points', () => {
    const result = assessCoverage(
      [{ easting: 0, northing: 0 }],
      [],
      false
    );
    expect(result.issues.some(i => i.includes('minimum 10'))).toBe(true);
  });

  it('flags missing breaklines', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      easting: i * 10,
      northing: i * 10,
    }));
    const result = assessCoverage(points, [], false);
    expect(result.issues.some(i => i.includes('No breaklines'))).toBe(true);
  });

  it('flags missing boundary', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      easting: i * 10,
      northing: i * 10,
    }));
    const result = assessCoverage(points, [], false);
    expect(result.issues.some(i => i.includes('No survey boundary'))).toBe(true);
  });

  it('flags low point density', () => {
    const points = Array.from({ length: 15 }, (_, i) => ({
      easting: i * 100,  // spread across 1400m x 1400m area = ~2 km²
      northing: i * 100,
    }));
    const result = assessCoverage(points, [], false);
    expect(result.issues.some(i => i.includes('low'))).toBe(true);
  });

  it('flags missing hard breaklines', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      easting: i * 10,
      northing: i * 10,
    }));
    const result = assessCoverage(
      points,
      [{ name: 'Ridge', type: 'soft', vertices: [], length: 100 }],
      true
    );
    expect(result.issues.some(i => i.includes('No hard breaklines'))).toBe(true);
  });

  it('passes when all criteria are met', () => {
    // 500 points across 0.5 km² (density = 1000/km²)
    const points = [];
    for (let i = 0; i < 500; i++) {
      points.push({
        easting: (i % 25) * 20,
        northing: Math.floor(i / 25) * 20,
      });
    }
    const result = assessCoverage(
      points,
      [
        { name: 'Road Edge', type: 'hard', vertices: [], length: 100 },
        { name: 'Ridge', type: 'soft', vertices: [], length: 80 },
      ],
      true
    );
    expect(result.issues).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
  });
});
