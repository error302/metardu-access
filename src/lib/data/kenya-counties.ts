/**
 * Kenya County Boundaries — simplified centroids + bounding boxes for map overlays.
 *
 * Full county boundary polygons would be a large GeoJSON file (~2MB).
 * For v0.5 we ship county centroids + bounding boxes for map labeling.
 * The desktop can export full polygons as MBTiles for offline use.
 *
 * Source: Kenya National Bureau of Statistics, 2019 Census
 */

export interface CountyInfo {
  code: number;
  name: string;
  capital: string;
  centroid: { lat: number; lng: number };
  bbox: { north: number; south: number; east: number; west: number };
  areaSqKm: number;
  region: 'Nairobi' | 'Central' | 'Western' | 'Nyanza' | 'Rift Valley' | 'Eastern' | 'Coastern' | 'North Eastern';
}

export const KENYA_COUNTIES: CountyInfo[] = [
  { code: 1, name: 'Mombasa', capital: 'Mombasa', centroid: { lat: -4.0435, lng: 39.6682 }, bbox: { north: -3.95, south: -4.20, east: 39.80, west: 39.55 }, areaSqKm: 219, region: 'Coastern' },
  { code: 2, name: 'Kwale', capital: 'Kwale', centroid: { lat: -4.1733, lng: 39.4529 }, bbox: { north: -3.50, south: -4.70, east: 39.70, west: 38.90 }, areaSqKm: 8270, region: 'Coastern' },
  { code: 3, name: 'Kilifi', capital: 'Kilifi', centroid: { lat: -3.6298, lng: 39.8499 }, bbox: { north: -2.50, south: -4.20, east: 40.80, west: 39.20 }, areaSqKm: 12246, region: 'Coastern' },
  { code: 4, name: 'Tana River', capital: 'Hola', centroid: { lat: -1.5481, lng: 40.0313 }, bbox: { north: 0.20, south: -2.50, east: 41.50, west: 38.70 }, areaSqKm: 35375, region: 'Coastern' },
  { code: 5, name: 'Lamu', capital: 'Lamu', centroid: { lat: -2.2717, lng: 40.9020 }, bbox: { north: -1.70, south: -2.80, east: 41.80, west: 40.20 }, areaSqKm: 6167, region: 'Coastern' },
  { code: 6, name: 'Taita-Taveta', capital: 'Voi', centroid: { lat: -3.4032, lng: 38.4844 }, bbox: { north: -2.80, south: -4.20, east: 39.20, west: 37.80 }, areaSqKm: 17084, region: 'Coastern' },
  { code: 7, name: 'Garissa', capital: 'Garissa', centroid: { lat: -0.4536, lng: 39.6461 }, bbox: { north: 1.20, south: -2.50, east: 41.50, west: 38.20 }, areaSqKm: 44175, region: 'North Eastern' },
  { code: 8, name: 'Wajir', capital: 'Wajir', centroid: { lat: 1.7472, lng: 40.0573 }, bbox: { north: 3.50, south: 0.20, east: 41.50, west: 38.50 }, areaSqKm: 55841, region: 'North Eastern' },
  { code: 9, name: 'Mandera', capital: 'Mandera', centroid: { lat: 3.9373, lng: 41.8569 }, bbox: { north: 4.50, south: 3.00, east: 42.50, west: 40.50 }, areaSqKm: 25797, region: 'North Eastern' },
  { code: 10, name: 'Marsabit', capital: 'Marsabit', centroid: { lat: 2.4439, lng: 37.9861 }, bbox: { north: 4.50, south: 0.50, east: 39.00, west: 36.50 }, areaSqKm: 66923, region: 'Eastern' },
  { code: 11, name: 'Isiolo', capital: 'Isiolo', centroid: { lat: 0.3549, lng: 37.5822 }, bbox: { north: 1.20, south: -0.70, east: 38.50, west: 36.80 }, areaSqKm: 25336, region: 'Eastern' },
  { code: 12, name: 'Meru', capital: 'Meru', centroid: { lat: 0.0460, lng: 37.6456 }, bbox: { north: 0.50, south: -0.50, east: 38.20, west: 37.00 }, areaSqKm: 6936, region: 'Eastern' },
  { code: 13, name: 'Tharaka-Nithi', capital: 'Chuka', centroid: { lat: -0.3050, lng: 37.6400 }, bbox: { north: 0.00, south: -0.70, east: 38.00, west: 37.20 }, areaSqKm: 2609, region: 'Eastern' },
  { code: 14, name: 'Embu', capital: 'Embu', centroid: { lat: -0.5344, lng: 37.4506 }, bbox: { north: -0.20, south: -0.90, east: 37.80, west: 37.00 }, areaSqKm: 2818, region: 'Eastern' },
  { code: 15, name: 'Kitui', capital: 'Kitui', centroid: { lat: -1.3648, lng: 38.0112 }, bbox: { north: -0.50, south: -2.50, east: 39.00, west: 37.20 }, areaSqKm: 30330, region: 'Eastern' },
  { code: 16, name: 'Machakos', capital: 'Machakos', centroid: { lat: -1.5167, lng: 37.2667 }, bbox: { north: -0.80, south: -2.30, east: 37.90, west: 36.70 }, areaSqKm: 6208, region: 'Eastern' },
  { code: 17, name: 'Makueni', capital: 'Wote', centroid: { lat: -1.9036, lng: 37.6293 }, bbox: { north: -1.30, south: -2.70, east: 38.30, west: 37.00 }, areaSqKm: 8009, region: 'Eastern' },
  { code: 18, name: 'Nyandarua', capital: 'Ol Kalou', centroid: { lat: -0.4167, lng: 36.4333 }, bbox: { north: 0.20, south: -1.00, east: 37.00, west: 35.80 }, areaSqKm: 3282, region: 'Central' },
  { code: 19, name: 'Nyeri', capital: 'Nyeri', centroid: { lat: -0.4167, lng: 36.9500 }, bbox: { north: 0.00, south: -0.90, east: 37.40, west: 36.50 }, areaSqKm: 3284, region: 'Central' },
  { code: 20, name: 'Kirinyaga', capital: 'Kerugoya', centroid: { lat: -0.5019, lng: 37.3000 }, bbox: { north: -0.30, south: -0.80, east: 37.60, west: 37.00 }, areaSqKm: 1479, region: 'Central' },
  { code: 21, name: "Murang'a", capital: "Murang'a", centroid: { lat: -0.7167, lng: 37.1500 }, bbox: { north: -0.40, south: -1.10, east: 37.60, west: 36.60 }, areaSqKm: 2558, region: 'Central' },
  { code: 22, name: 'Kiambu', capital: 'Kiambu', centroid: { lat: -1.1714, lng: 36.8356 }, bbox: { north: -0.70, south: -1.40, east: 37.30, west: 36.40 }, areaSqKm: 2543, region: 'Central' },
  { code: 23, name: 'Turkana', capital: 'Lodwar', centroid: { lat: 2.4439, lng: 35.5973 }, bbox: { north: 4.50, south: 0.50, east: 37.00, west: 34.00 }, areaSqKm: 71597, region: 'Rift Valley' },
  { code: 24, name: 'West Pokot', capital: 'Kapenguria', centroid: { lat: 1.2378, lng: 35.5667 }, bbox: { north: 2.20, south: 0.20, east: 36.20, west: 34.80 }, areaSqKm: 9163, region: 'Rift Valley' },
  { code: 25, name: 'Samburu', capital: 'Maralal', centroid: { lat: 1.1056, lng: 36.8000 }, bbox: { north: 2.20, south: 0.00, east: 37.80, west: 35.80 }, areaSqKm: 21907, region: 'Rift Valley' },
  { code: 26, name: 'Trans Nzoia', capital: 'Kitale', centroid: { lat: 1.0244, lng: 34.9861 }, bbox: { north: 1.40, south: 0.60, east: 35.50, west: 34.50 }, areaSqKm: 2485, region: 'Rift Valley' },
  { code: 27, name: 'Uasin Gishu', capital: 'Eldoret', centroid: { lat: 0.5143, lng: 35.2697 }, bbox: { north: 1.10, south: 0.00, east: 35.80, west: 34.70 }, areaSqKm: 3384, region: 'Rift Valley' },
  { code: 28, name: 'Elgeyo-Marakwet', capital: 'Iten', centroid: { lat: 0.5211, lng: 35.4700 }, bbox: { north: 1.10, south: 0.00, east: 36.00, west: 35.20 }, areaSqKm: 3030, region: 'Rift Valley' },
  { code: 29, name: 'Nandi', capital: 'Kapsabet', centroid: { lat: 0.2028, lng: 35.0975 }, bbox: { north: 0.60, south: -0.30, east: 35.60, west: 34.70 }, areaSqKm: 2887, region: 'Rift Valley' },
  { code: 30, name: 'Baringo', capital: 'Kabarnet', centroid: { lat: 0.4750, lng: 35.7400 }, bbox: { north: 1.40, south: -0.50, east: 36.80, west: 35.20 }, areaSqKm: 11075, region: 'Rift Valley' },
  { code: 31, name: 'Laikipia', capital: 'Rumuruti', centroid: { lat: 0.3556, lng: 36.4000 }, bbox: { north: 1.00, south: -0.30, east: 37.20, west: 35.80 }, areaSqKm: 9533, region: 'Rift Valley' },
  { code: 32, name: 'Nakuru', capital: 'Nakuru', centroid: { lat: -0.3031, lng: 36.0800 }, bbox: { north: 0.30, south: -1.00, east: 36.80, west: 35.20 }, areaSqKm: 7535, region: 'Rift Valley' },
  { code: 33, name: 'Narok', capital: 'Narok', centroid: { lat: -1.0783, lng: 35.8706 }, bbox: { north: -0.30, south: -2.50, east: 36.80, west: 34.80 }, areaSqKm: 17933, region: 'Rift Valley' },
  { code: 34, name: 'Kajiado', capital: 'Kajiado', centroid: { lat: -1.8550, lng: 36.7800 }, bbox: { north: -1.20, south: -3.00, east: 37.80, west: 36.20 }, areaSqKm: 21802, region: 'Rift Valley' },
  { code: 35, name: 'Kericho', capital: 'Kericho', centroid: { lat: -0.3675, lng: 35.2842 }, bbox: { north: 0.10, south: -0.90, east: 35.90, west: 34.80 }, areaSqKm: 2455, region: 'Rift Valley' },
  { code: 36, name: 'Bomet', capital: 'Bomet', centroid: { lat: -0.7828, lng: 35.3489 }, bbox: { north: -0.40, south: -1.20, east: 35.80, west: 34.80 }, areaSqKm: 2030, region: 'Rift Valley' },
  { code: 37, name: 'Kakamega', capital: 'Kakamega', centroid: { lat: 0.2861, lng: 34.7522 }, bbox: { north: 0.70, south: -0.30, east: 35.30, west: 34.30 }, areaSqKm: 3224, region: 'Western' },
  { code: 38, name: 'Vihiga', capital: 'Vihiga', centroid: { lat: 0.0667, lng: 34.7167 }, bbox: { north: 0.30, south: -0.20, east: 35.00, west: 34.50 }, areaSqKm: 564, region: 'Western' },
  { code: 39, name: 'Bungoma', capital: 'Bungoma', centroid: { lat: 0.5700, lng: 34.5600 }, bbox: { north: 1.10, south: 0.20, east: 35.00, west: 34.20 }, areaSqKm: 3032, region: 'Western' },
  { code: 40, name: 'Busia', capital: 'Busia', centroid: { lat: 0.4600, lng: 34.1100 }, bbox: { north: 0.90, south: 0.00, east: 34.60, west: 33.80 }, areaSqKm: 1695, region: 'Western' },
  { code: 41, name: 'Siaya', capital: 'Siaya', centroid: { lat: -0.0628, lng: 34.2883 }, bbox: { north: 0.30, south: -0.70, east: 34.50, west: 33.80 }, areaSqKm: 2530, region: 'Nyanza' },
  { code: 42, name: 'Kisumu', capital: 'Kisumu', centroid: { lat: -0.0917, lng: 34.7680 }, bbox: { north: 0.10, south: -0.50, east: 35.00, west: 34.50 }, areaSqKm: 2086, region: 'Nyanza' },
  { code: 43, name: 'Homa Bay', capital: 'Homa Bay', centroid: { lat: -0.5244, lng: 34.4572 }, bbox: { north: -0.20, south: -1.20, east: 34.80, west: 34.00 }, areaSqKm: 3183, region: 'Nyanza' },
  { code: 44, name: 'Migori', capital: 'Migori', centroid: { lat: -1.0636, lng: 34.4717 }, bbox: { north: -0.60, south: -1.80, east: 34.90, west: 33.90 }, areaSqKm: 2586, region: 'Nyanza' },
  { code: 45, name: 'Kisii', capital: 'Kisii', centroid: { lat: -0.6767, lng: 34.7667 }, bbox: { north: -0.40, south: -0.90, east: 35.00, west: 34.50 }, areaSqKm: 1318, region: 'Nyanza' },
  { code: 46, name: 'Nyamira', capital: 'Nyamira', centroid: { lat: -0.5667, lng: 34.9333 }, bbox: { north: -0.30, south: -0.80, east: 35.20, west: 34.70 }, areaSqKm: 913, region: 'Nyanza' },
  { code: 47, name: 'Nairobi', capital: 'Nairobi', centroid: { lat: -1.2864, lng: 36.8172 }, bbox: { north: -1.10, south: -1.50, east: 37.10, west: 36.60 }, areaSqKm: 704, region: 'Nairobi' },
];

/**
 * Get county by name (case-insensitive).
 */
export function getCountyByName(name: string): CountyInfo | undefined {
  const lower = name.toLowerCase().trim();
  return KENYA_COUNTIES.find(c => c.name.toLowerCase() === lower);
}

/**
 * Get county by code.
 */
export function getCountyByCode(code: number): CountyInfo | undefined {
  return KENYA_COUNTIES.find(c => c.code === code);
}

/**
 * Find which county contains a given coordinate.
 */
export function findCountyAt(lat: number, lng: number): CountyInfo | undefined {
  return KENYA_COUNTIES.find(c =>
    lat <= c.bbox.north && lat >= c.bbox.south &&
    lng <= c.bbox.east && lng >= c.bbox.west
  );
}

/**
 * Convert counties to GeoJSON Point features (centroids) for map overlay.
 */
export function countiesToGeoJSON(): object {
  return {
    type: 'FeatureCollection',
    features: KENYA_COUNTIES.map(c => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [c.centroid.lng, c.centroid.lat],
      },
      properties: {
        code: c.code,
        name: c.name,
        capital: c.capital,
        region: c.region,
        areaSqKm: c.areaSqKm,
      },
    })),
  };
}
