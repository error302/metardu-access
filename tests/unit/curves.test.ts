/**
 * @metardu/engine — Curve geometry tests
 */

import {
  horizontalCurve,
  curveDeflections,
  verticalCurve,
  elevationOnVerticalCurve,
} from '../../packages/engine/src/curves';

describe('horizontalCurve', () => {
  it('computes a 90° curve with radius 100m', () => {
    const curve = horizontalCurve(
      { easting: 1000, northing: 1000 },
      0,    // back tangent: due north
      90,   // forward tangent: due east
      100
    );
    expect(curve.deflectionAngle).toBeCloseTo(90, 5);
    expect(curve.tangentLength).toBeCloseTo(100, 0); // 100 * tan(45°) = 100
    expect(curve.arcLength).toBeCloseTo(Math.PI * 100 / 2, 2); // quarter circle
    expect(curve.chordLength).toBeCloseTo(Math.sqrt(2) * 100, 1);
  });

  it('places PC behind PI along back tangent', () => {
    const curve = horizontalCurve(
      { easting: 1000, northing: 1000 },
      0,
      90,
      100
    );
    // PC should be 100m south of PI (back tangent due north, so back is south)
    expect(curve.PC.northing).toBeCloseTo(900, 0);
    expect(curve.PC.easting).toBeCloseTo(1000, 5);
  });

  it('places PT ahead along forward tangent', () => {
    const curve = horizontalCurve(
      { easting: 1000, northing: 1000 },
      0,
      90,
      100
    );
    // PT should be 100m east of PI (forward tangent due east)
    expect(curve.PT.easting).toBeCloseTo(1100, 0);
    expect(curve.PT.northing).toBeCloseTo(1000, 5);
  });

  it('computes degree of curve', () => {
    const curve = horizontalCurve(
      { easting: 0, northing: 0 },
      0,
      30,
      572.958 // R = 572.958 → 3° curve (arc definition)
    );
    expect(curve.degreeOfCurve).toBeCloseTo(3, 1);
  });
});

describe('curveDeflections', () => {
  it('produces deflection angles at each station interval', () => {
    const curve = horizontalCurve(
      { easting: 0, northing: 0 },
      0,
      90,
      100
    );
    const defs = curveDeflections(curve, 10);
    expect(defs.length).toBeGreaterThan(5);
    expect(defs[0].station).toBe(0);
    expect(defs[0].deflectionAngle).toBe(0);
    // Final deflection should be half of total deflection angle
    const last = defs[defs.length - 1];
    expect(last.deflectionAngle).toBeCloseTo(curve.deflectionAngle / 2, 2);
  });

  it('respects station interval', () => {
    const curve = horizontalCurve(
      { easting: 0, northing: 0 },
      0,
      45,
      200
    );
    const defs = curveDeflections(curve, 20);
    for (let i = 1; i < defs.length - 1; i++) {
      expect(defs[i].station - defs[i - 1].station).toBeCloseTo(20, 1);
    }
  });
});

describe('verticalCurve', () => {
  it('computes PVC and PVT from PVI', () => {
    const vc = verticalCurve(1000, 100, 2, -2, 100);
    // PVI at station 1000, length 100 → half length 50
    expect(vc.PVC.station).toBeCloseTo(950, 1);
    expect(vc.PVT.station).toBeCloseTo(1050, 1);
    // PVC elevation = 100 - (2% * 50m / 100) = 100 - 1 = 99
    expect(vc.PVC.elevation).toBeCloseTo(99, 2);
    // PVT elevation = 100 + (-2% * 50m / 100) = 100 - 1 = 99
    expect(vc.PVT.elevation).toBeCloseTo(99, 2);
  });

  it('computes K-value', () => {
    const vc = verticalCurve(1000, 100, 2, -2, 100);
    expect(vc.kValue).toBeCloseTo(25, 1); // 100 / |(-2) - 2| = 25
  });
});

describe('elevationOnVerticalCurve', () => {
  it('returns PVC elevation at PVC station', () => {
    const vc = verticalCurve(1000, 100, 2, -2, 100);
    const elev = elevationOnVerticalCurve(vc, 950);
    expect(elev).toBeCloseTo(99, 2);
  });

  it('returns PVI elevation at PVI station', () => {
    const vc = verticalCurve(1000, 100, 2, -2, 100);
    const elev = elevationOnVerticalCurve(vc, 1000);
    expect(elev).toBeCloseTo(100, 1);
  });

  it('returns PVT elevation at PVT station', () => {
    const vc = verticalCurve(1000, 100, 2, -2, 100);
    const elev = elevationOnVerticalCurve(vc, 1050);
    expect(elev).toBeCloseTo(99, 2);
  });

  it('uses tangent grade outside curve range', () => {
    const vc = verticalCurve(1000, 100, 2, -2, 100);
    // 25m before PVC (station 925): elevation = 99 - (2% * 25 / 100) = 98.5
    const elev = elevationOnVerticalCurve(vc, 925);
    expect(elev).toBeCloseTo(98.5, 2);
  });
});
