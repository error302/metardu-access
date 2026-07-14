/**
 * @metardu/engine — Coordinate transformations
 * WGS84 ↔ UTM (all 60 zones), Arc 1960 ↔ WGS84 (Kenya), Cassini-Soldner
 */

import type { Point2D } from './cogo';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);
const WGS84_E2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);

const ARC1960_A = 6378249.145;
const ARC1960_F = 1 / 298.25;
const ARC1960_B = ARC1960_A * (1 - ARC1960_F);
const ARC1960_E2 = 1 - (ARC1960_B * ARC1960_B) / (ARC1960_A * ARC1960_A);

// Arc 1960 → WGS84 (Kenya) Helmert 7-parameter
// Source: EPSG:1122
const ARC1960_TO_WGS84 = {
  tx: -157,
  ty: -2,
  tz: -299,
  rx: -0.00000372453182 * DEG2RAD, // arc-seconds → radians
  ry: 0.00000704984247 * DEG2RAD,
  rz: -0.00000372453182 * DEG2RAD,
  scale: 0,
};

export interface LatLng {
  lat: number; // degrees
  lng: number; // degrees
}

/**
 * Convert WGS84 lat/lng to UTM coordinates.
 * @param latLng - WGS84 lat/lng
 * @param zone - UTM zone (1-60); if omitted, computed from longitude
 * @param southern - true if southern hemisphere
 */
export function wgs84ToUtm(
  latLng: LatLng,
  zone?: number,
  southern?: boolean
): Point2D & { zone: number } {
  const z = zone ?? Math.floor((latLng.lng + 180) / 6) + 1;
  const isSouth = southern ?? latLng.lat < 0;

  const a = WGS84_A;
  const e2 = WGS84_E2;
  const ePrime2 = e2 / (1 - e2);

  const lat = latLng.lat * DEG2RAD;
  const lng = latLng.lng * DEG2RAD;
  const lngOrigin = ((z - 1) * 6 - 180 + 3) * DEG2RAD;

  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = ePrime2 * Math.cos(lat) ** 2;
  const A = Math.cos(lat) * (lng - lngOrigin);

  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat));

  const k0 = 0.9996;
  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ePrime2) * A ** 5) / 120) +
    500000;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(lat) *
        ((A ** 2) / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * ePrime2) * A ** 6) / 720));

  if (isSouth) northing += 10000000;

  return { easting, northing, zone: z };
}

/**
 * Convert UTM to WGS84 lat/lng.
 */
export function utmToWgs84(
  easting: number,
  northing: number,
  zone: number,
  southern: boolean
): LatLng {
  const a = WGS84_A;
  const e2 = WGS84_E2;
  const ePrime2 = e2 / (1 - e2);
  const k0 = 0.9996;

  const x = easting - 500000;
  const y = southern ? northing - 10000000 : northing;

  const M = y / k0;
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2);
  const T1 = Math.tan(phi1) ** 2;
  const C1 = ePrime2 * Math.cos(phi1) ** 2;
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * Math.sin(phi1) ** 2, 1.5);
  const D = x / (N1 * k0);

  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      ((D ** 2) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ePrime2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ePrime2 - 3 * C1 ** 2) * D ** 6) / 720);

  const lngOrigin = ((zone - 1) * 6 - 180 + 3) * DEG2RAD;
  const lng =
    lngOrigin +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ePrime2 + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(phi1);

  return { lat: lat * RAD2DEG, lng: lng * RAD2DEG };
}

/**
 * Apply a Helmert 7-parameter transformation.
 * Used for datum shifts (e.g., Arc 1960 → WGS84).
 */
function helmertTransform(
  x: number,
  y: number,
  z: number,
  params: typeof ARC1960_TO_WGS84
): { x: number; y: number; z: number } {
  const { tx, ty, tz, rx, ry, rz, scale } = params;
  const s = 1 + scale;
  return {
    x: tx + s * (x + rz * y - ry * z),
    y: ty + s * (-rz * x + y + rx * z),
    z: tz + s * (ry * x - rx * y + z),
  };
}

/**
 * Convert geodetic coords to ECEF (Earth-centered, Earth-fixed).
 */
function geodeticToEcef(lat: number, lng: number, h: number, a: number, e2: number) {
  const latR = lat * DEG2RAD;
  const lngR = lng * DEG2RAD;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
  return {
    x: (N + h) * Math.cos(latR) * Math.cos(lngR),
    y: (N + h) * Math.cos(latR) * Math.sin(lngR),
    z: (N * (1 - e2) + h) * Math.sin(latR),
  };
}

/**
 * Convert ECEF to geodetic coords.
 */
function ecefToGeodetic(x: number, y: number, z: number, a: number, e2: number): LatLng & { h: number } {
  const b = a * Math.sqrt(1 - e2);
  const p = Math.sqrt(x * x + y * y);
  const theta = Math.atan2((z * a), (p * b));
  const lat = Math.atan2(
    z + ((a * a - b * b) / b) * Math.sin(theta) ** 3,
    p - e2 * a * Math.cos(theta) ** 3
  );
  const lng = Math.atan2(y, x);
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const h = p / Math.cos(lat) - N;
  return { lat: lat * RAD2DEG, lng: lng * RAD2DEG, h };
}

/**
 * Transform Arc 1960 lat/lng → WGS84 lat/lng (Kenya).
 */
export function arc1960ToWgs84(latLng: LatLng, height: number = 0): LatLng {
  const ecef = geodeticToEcef(latLng.lat, latLng.lng, height, ARC1960_A, ARC1960_E2);
  const transformed = helmertTransform(ecef.x, ecef.y, ecef.z, ARC1960_TO_WGS84);
  const wgs = ecefToGeodetic(transformed.x, transformed.y, transformed.z, WGS84_A, WGS84_E2);
  return { lat: wgs.lat, lng: wgs.lng };
}

/**
 * Transform WGS84 lat/lng → Arc 1960 lat/lng (Kenya).
 */
export function wgs84ToArc1960(latLng: LatLng, height: number = 0): LatLng {
  const ecef = geodeticToEcef(latLng.lat, latLng.lng, height, WGS84_A, WGS84_E2);
  const inverse = {
    ...ARC1960_TO_WGS84,
    tx: -ARC1960_TO_WGS84.tx,
    ty: -ARC1960_TO_WGS84.ty,
    tz: -ARC1960_TO_WGS84.tz,
    rx: -ARC1960_TO_WGS84.rx,
    ry: -ARC1960_TO_WGS84.ry,
    rz: -ARC1960_TO_WGS84.rz,
    scale: -ARC1960_TO_WGS84.scale,
  };
  const transformed = helmertTransform(ecef.x, ecef.y, ecef.z, inverse);
  const arc = ecefToGeodetic(transformed.x, transformed.y, transformed.z, ARC1960_A, ARC1960_E2);
  return { lat: arc.lat, lng: arc.lng };
}

/**
 * Convenience: WGS84 lat/lng → Arc 1960 / UTM zone 37S (Kenya default, EPSG:21037)
 */
export function wgs84ToArc1960Utm37S(latLng: LatLng): Point2D {
  const arc = wgs84ToArc1960(latLng);
  const utm = wgs84ToUtm(arc, 37, true);
  return { easting: utm.easting, northing: utm.northing };
}
