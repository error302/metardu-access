/**
 * @metardu/engine — GCP (Ground Control Point) tests
 */

import {
  assessGCPDistribution,
  gcpsToCsv,
  gcpsToWebODM,
  gcpsToGeoJSON,
  nextGcpId,
} from '../../packages/engine/src/gcps';

describe('assessGCPDistribution', () => {
  it('flags empty GCP set', () => {
    const result = assessGCPDistribution([]);
    expect(result.count).toBe(0);
    expect(result.issues[0]).toContain('No GCPs');
    expect(result.recommendations[0]).toContain('at least 5');
  });

  it('flags too few GCPs', () => {
    const result = assessGCPDistribution([
      { gcpId: 'GCP-001', easting: 0, northing: 0, elevation: 100 },
      { gcpId: 'GCP-002', easting: 50, northing: 0, elevation: 101 },
    ]);
    expect(result.issues.some(i => i.includes('minimum 5'))).toBe(true);
  });

  it('flags no fixed solutions', () => {
    const gcps = Array.from({ length: 6 }, (_, i) => ({
      gcpId: `GCP-${String(i + 1).padStart(3, '0')}`,
      easting: i * 100,
      northing: i * 100,
      elevation: 100,
      solutionType: 'float' as const,
    }));
    const result = assessGCPDistribution(gcps);
    expect(result.issues.some(i => i.includes('No RTK Fixed'))).toBe(true);
    expect(result.hasFixedSolution).toBe(false);
  });

  it('flags large spacing', () => {
    const result = assessGCPDistribution([
      { gcpId: 'GCP-001', easting: 0, northing: 0, elevation: 100, solutionType: 'fixed' },
      { gcpId: 'GCP-002', easting: 300, northing: 0, elevation: 101, solutionType: 'fixed' },
    ]);
    expect(result.issues.some(i => i.includes('200m'))).toBe(true);
  });

  it('flags very close GCPs', () => {
    const result = assessGCPDistribution([
      { gcpId: 'GCP-001', easting: 0, northing: 0, elevation: 100, solutionType: 'fixed' },
      { gcpId: 'GCP-002', easting: 5, northing: 0, elevation: 101, solutionType: 'fixed' },
    ]);
    expect(result.issues.some(i => i.includes('very close'))).toBe(true);
  });

  it('passes with good distribution', () => {
    const gcps = [
      { gcpId: 'GCP-001', easting: 0, northing: 0, elevation: 100, solutionType: 'fixed' as const, accuracyMm: 15 },
      { gcpId: 'GCP-002', easting: 100, northing: 0, elevation: 101, solutionType: 'fixed' as const, accuracyMm: 18 },
      { gcpId: 'GCP-003', easting: 100, northing: 100, elevation: 102, solutionType: 'fixed' as const, accuracyMm: 12 },
      { gcpId: 'GCP-004', easting: 0, northing: 100, elevation: 100, solutionType: 'fixed' as const, accuracyMm: 20 },
      { gcpId: 'GCP-005', easting: 50, northing: 50, elevation: 101, solutionType: 'fixed' as const, accuracyMm: 16 },
    ];
    const result = assessGCPDistribution(gcps);
    expect(result.count).toBe(5);
    expect(result.hasFixedSolution).toBe(true);
    expect(result.accuracyClass).toBe('cm');
  });

  it('classifies accuracy correctly', () => {
    expect(assessGCPDistribution([
      { gcpId: 'GCP-001', easting: 0, northing: 0, elevation: 100, accuracyMm: 15 },
      { gcpId: 'GCP-002', easting: 50, northing: 0, elevation: 100, accuracyMm: 18 },
      { gcpId: 'GCP-003', easting: 100, northing: 0, elevation: 100, accuracyMm: 20 },
      { gcpId: 'GCP-004', easting: 150, northing: 0, elevation: 100, accuracyMm: 17 },
      { gcpId: 'GCP-005', easting: 200, northing: 0, elevation: 100, accuracyMm: 19 },
    ]).accuracyClass).toBe('cm');

    expect(assessGCPDistribution([
      { gcpId: 'GCP-001', easting: 0, northing: 0, elevation: 100, accuracyMm: 50 },
      { gcpId: 'GCP-002', easting: 50, northing: 0, elevation: 100, accuracyMm: 60 },
      { gcpId: 'GCP-003', easting: 100, northing: 0, elevation: 100, accuracyMm: 70 },
      { gcpId: 'GCP-004', easting: 150, northing: 0, elevation: 100, accuracyMm: 80 },
      { gcpId: 'GCP-005', easting: 200, northing: 0, elevation: 100, accuracyMm: 90 },
    ]).accuracyClass).toBe('dm');
  });
});

describe('gcpsToCsv', () => {
  it('produces CSV with WGS84 coordinates when available', () => {
    const csv = gcpsToCsv([
      { gcpId: 'GCP-001', easting: 254500, northing: 9857200, elevation: 1795, lat: -1.2864, lng: 36.8172, height: 1838, accuracyMm: 15, solutionType: 'fixed' },
    ], true);
    expect(csv).toContain('gcp_id,lat,lng,height,accuracy_mm,solution_type');
    expect(csv).toContain('GCP-001');
    expect(csv).toContain('-1.286400000');
    expect(csv).toContain('36.817200000');
  });

  it('falls back to local grid when no WGS84', () => {
    const csv = gcpsToCsv([
      { gcpId: 'GCP-001', easting: 254500, northing: 9857200, elevation: 1795 },
    ], true);
    expect(csv).toContain('gcp_id,easting,northing,elevation');
    expect(csv).toContain('254500.0000');
  });

  it('handles empty GCP list', () => {
    expect(gcpsToCsv([], true)).toBe('');
  });
});

describe('gcpsToWebODM', () => {
  it('produces WebODM format: lat lng height "gcp_id"', () => {
    const txt = gcpsToWebODM([
      { gcpId: 'GCP-001', easting: 254500, northing: 9857200, elevation: 1795, lat: -1.2864, lng: 36.8172, height: 1838 },
      { gcpId: 'GCP-002', easting: 254600, northing: 9857300, elevation: 1796, lat: -1.2853, lng: 36.8285, height: 1839 },
    ]);
    expect(txt).toContain('-1.286400000 36.817200000 1838.0000 "GCP-001"');
    expect(txt).toContain('-1.285300000 36.828500000 1839.0000 "GCP-002"');
  });

  it('skips GCPs without WGS84 coordinates', () => {
    const txt = gcpsToWebODM([
      { gcpId: 'GCP-001', easting: 254500, northing: 9857200, elevation: 1795 },
      { gcpId: 'GCP-002', easting: 254600, northing: 9857300, elevation: 1796, lat: -1.2853, lng: 36.8285, height: 1839 },
    ]);
    expect(txt).not.toContain('GCP-001');
    expect(txt).toContain('GCP-002');
  });
});

describe('gcpsToGeoJSON', () => {
  it('produces valid GeoJSON FeatureCollection', () => {
    const geo = gcpsToGeoJSON([
      { gcpId: 'GCP-001', easting: 254500, northing: 9857200, elevation: 1795, lat: -1.2864, lng: 36.8172, height: 1838 },
    ]);
    expect(geo).toEqual({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [36.8172, -1.2864, 1838] },
        properties: {
          gcpId: 'GCP-001',
          accuracyMm: undefined,
          solutionType: undefined,
          numSatellites: undefined,
          targetType: undefined,
        },
      }],
    });
  });

  it('uses local grid when no WGS84', () => {
    const geo: any = gcpsToGeoJSON([
      { gcpId: 'GCP-001', easting: 254500, northing: 9857200, elevation: 1795 },
    ]);
    expect(geo.features[0].geometry.coordinates).toEqual([254500, 9857200, 1795]);
  });
});

describe('nextGcpId', () => {
  it('returns GCP-001 when no existing GCPs', () => {
    expect(nextGcpId([])).toBe('GCP-001');
  });

  it('increments from the highest existing number', () => {
    expect(nextGcpId(['GCP-001', 'GCP-002', 'GCP-003'])).toBe('GCP-004');
  });

  it('handles non-sequential existing IDs', () => {
    expect(nextGcpId(['GCP-001', 'GCP-005', 'GCP-002'])).toBe('GCP-006');
  });

  it('handles lowercase prefix', () => {
    expect(nextGcpId(['gcp-001', 'gcp-002'])).toBe('GCP-003');
  });
});
