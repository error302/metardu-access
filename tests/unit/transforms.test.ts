/**
 * @metardu/engine — Coordinate transformations tests
 */

import {
  wgs84ToUtm,
  utmToWgs84,
  arc1960ToWgs84,
  wgs84ToArc1960,
  wgs84ToArc1960Utm37S,
} from '../../packages/engine/src/transforms';

describe('wgs84ToUtm', () => {
  it('converts Nairobi to UTM zone 37S', () => {
    // Nairobi: -1.2864°S, 36.8172°E
    const result = wgs84ToUtm({ lat: -1.2864, lng: 36.8172 }, 37, true);
    expect(result.zone).toBe(37);
    expect(result.easting).toBeGreaterThan(200000);
    expect(result.easting).toBeLessThan(800000);
    expect(result.northing).toBeGreaterThan(9000000); // southern hemisphere offset
  });

  it('auto-detects zone from longitude', () => {
    const result = wgs84ToUtm({ lat: 0, lng: 35 });
    expect(result.zone).toBe(36);
    const result2 = wgs84ToUtm({ lat: 0, lng: 41 });
    expect(result2.zone).toBe(37);
  });
});

describe('utmToWgs84 (round-trip)', () => {
  it('round-trips a Nairobi coordinate through UTM', () => {
    const original = { lat: -1.2864, lng: 36.8172 };
    const utm = wgs84ToUtm(original, 37, true);
    const back = utmToWgs84(utm.easting, utm.northing, 37, true);
    expect(back.lat).toBeCloseTo(original.lat, 4);
    expect(back.lng).toBeCloseTo(original.lng, 4);
  });
});

describe('arc1960ToWgs84 / wgs84ToArc1960', () => {
  it('transforms a Kenya coordinate through Arc 1960 → WGS84 → Arc 1960', () => {
    const original = { lat: -1.2864, lng: 36.8172 };
    const wgs = arc1960ToWgs84(original);
    const back = wgs84ToArc1960(wgs);
    // Should be within ~1m of original (sub-arcsecond precision)
    expect(back.lat).toBeCloseTo(original.lat, 5);
    expect(back.lng).toBeCloseTo(original.lng, 5);
  });
});

describe('wgs84ToArc1960Utm37S', () => {
  it('converts a WGS84 GPS reading to Arc 1960 / UTM 37S (Kenya default)', () => {
    // Simulate a GPS reading in Nairobi
    const gps = { lat: -1.2864, lng: 36.8172 };
    const utm = wgs84ToArc1960Utm37S(gps);
    expect(utm.easting).toBeGreaterThan(200000);
    expect(utm.easting).toBeLessThan(800000);
    expect(utm.northing).toBeGreaterThan(9850000);
    expect(utm.northing).toBeLessThan(9860000);
  });
});
