/**
 * Offline tile cache manager — MBTiles support for MapLibre.
 *
 * Kenya rural areas have no internet. Surveyors need offline basemaps.
 * MBTiles is a SQLite-based tile format that MapLibre RN can read natively.
 *
 * Workflow:
 *   1. On desktop: use QGIS or the metardu-desktop app to export an MBTiles
 *      file for the survey area (satellite imagery or topographic map)
 *   2. Transfer the .mbtiles file to the phone via USB / AirDrop / cloud
 *   3. In Metardu Access: Settings → Offline Maps → Import MBTiles
 *   4. The map screens automatically use the offline tiles when available
 *
 * Tile sources tried in this order:
 *   1. User-imported MBTiles (if any)
 *   2. Online raster tiles (when network available)
 *   3. Online vector tiles (fallback)
 */

import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

const OFFLINE_DIR = FileSystem.documentDirectory + 'offline-maps/';
const MANIFEST_FILE = OFFLINE_DIR + 'manifest.json';

export interface OfflineMap {
  id: string;
  name: string;
  filePath: string;
  fileSizeBytes: number;
  importedAt: string;
  bounds?: { north: number; south: number; east: number; west: number };
  minZoom?: number;
  maxZoom?: number;
  isActive: boolean;
}

interface Manifest {
  maps: OfflineMap[];
  activeMapId: string | null;
}

let cachedManifest: Manifest | null = null;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(OFFLINE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true });
  }
}

async function loadManifest(): Promise<Manifest> {
  if (cachedManifest) return cachedManifest;
  await ensureDir();
  const info = await FileSystem.getInfoAsync(MANIFEST_FILE);
  if (!info.exists) {
    cachedManifest = { maps: [], activeMapId: null };
    await saveManifest(cachedManifest);
    return cachedManifest;
  }
  const raw = await FileSystem.readAsStringAsync(MANIFEST_FILE);
  try {
    cachedManifest = JSON.parse(raw);
  } catch {
    cachedManifest = { maps: [], activeMapId: null };
  }
  return cachedManifest;
}

async function saveManifest(manifest: Manifest): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(
    MANIFEST_FILE,
    JSON.stringify(manifest, null, 2)
  );
  cachedManifest = manifest;
}

/**
 * Pick an .mbtiles file from the device and import it.
 */
export async function importMBtiles(): Promise<OfflineMap | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/octet-stream',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const file = result.assets[0];
  if (!file.name.endsWith('.mbtiles')) {
    throw new Error('File must have .mbtiles extension');
  }

  await ensureDir();
  const destPath = OFFLINE_DIR + file.name;
  await FileSystem.copyAsync({
    from: file.uri,
    to: destPath,
  });

  const info = await FileSystem.getInfoAsync(destPath);
  const manifest = await loadManifest();

  const offlineMap: OfflineMap = {
    id: `map-${Date.now()}`,
    name: file.name.replace(/\.mbtiles$/i, ''),
    filePath: destPath,
    fileSizeBytes: info.size ?? 0,
    importedAt: new Date().toISOString(),
    isActive: manifest.maps.length === 0, // auto-activate first import
  };

  manifest.maps.push(offlineMap);
  if (offlineMap.isActive) {
    manifest.activeMapId = offlineMap.id;
  }
  await saveManifest(manifest);

  return offlineMap;
}

export async function getOfflineMaps(): Promise<OfflineMap[]> {
  const manifest = await loadManifest();
  return manifest.maps;
}

export async function getActiveMap(): Promise<OfflineMap | null> {
  const manifest = await loadManifest();
  if (!manifest.activeMapId) return null;
  return manifest.maps.find(m => m.id === manifest.activeMapId) ?? null;
}

export async function setActiveMap(id: string | null): Promise<void> {
  const manifest = await loadManifest();
  manifest.activeMapId = id;
  manifest.maps = manifest.maps.map(m => ({ ...m, isActive: m.id === id }));
  await saveManifest(manifest);
}

export async function deleteOfflineMap(id: string): Promise<void> {
  const manifest = await loadManifest();
  const map = manifest.maps.find(m => m.id === id);
  if (!map) return;
  await FileSystem.deleteAsync(map.filePath, { idempotent: true });
  manifest.maps = manifest.maps.filter(m => m.id !== id);
  if (manifest.activeMapId === id) {
    manifest.activeMapId = manifest.maps[0]?.id ?? null;
    if (manifest.maps[0]) manifest.maps[0].isActive = true;
  }
  await saveManifest(manifest);
}

/**
 * Get the MapLibre tile URL for the active offline map.
 * Returns null if no offline map is active.
 *
 * MapLibre RN can read MBTiles via the `mbtiles://` scheme on Android,
 * or via a local file:// URL on iOS.
 */
export async function getOfflineTileUrl(): Promise<string | null> {
  const map = await getActiveMap();
  if (!map) return null;

  if (Platform.OS === 'android') {
    // MapLibre RN supports mbtiles:// scheme on Android
    return `mbtiles://${map.name}`;
  } else {
    // iOS: use file:// URL
    return map.filePath;
  }
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
