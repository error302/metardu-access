/**
 * Feature code database queries — manage topo point codes per project.
 *
 * Kenya standard feature code library is pre-loaded on first project creation.
 * Surveyors can add custom codes per project.
 */

import { getDatabase, generateId, nowISO } from './schema';
import type { FeatureCode, FeatureLayer } from '@/types';

// ============================================================================
// Feature code CRUD
// ============================================================================
export async function createFeatureCode(input: {
  projectId: string;
  code: string;
  description?: string;
  layer?: FeatureLayer;
  color?: string;
  icon?: string;
}): Promise<FeatureCode> {
  const db = await getDatabase();
  const id = generateId();
  const now = nowISO();
  const upperCode = input.code.toUpperCase().trim();
  await db.runAsync(
    `INSERT INTO feature_codes (id, project_id, code, description, layer, color, icon, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      input.projectId,
      upperCode,
      input.description ?? null,
      input.layer ?? 'general',
      input.color ?? '#F97316',
      input.icon ?? 'map-marker',
      now,
    ]
  );
  return {
    id,
    projectId: input.projectId,
    code: upperCode,
    description: input.description,
    layer: input.layer ?? 'general',
    color: input.color ?? '#F97316',
    icon: input.icon ?? 'map-marker',
    isActive: true,
    createdAt: now,
  };
}

export async function getFeatureCodes(projectId: string, activeOnly: boolean = false): Promise<FeatureCode[]> {
  const db = await getDatabase();
  const sql = activeOnly
    ? `SELECT * FROM feature_codes WHERE project_id = ? AND is_active = 1 ORDER BY layer, code`
    : `SELECT * FROM feature_codes WHERE project_id = ? ORDER BY layer, code`;
  const rows = await db.getAllAsync<any>(sql, [projectId]);
  return rows.map(rowToFeatureCode);
}

export async function updateFeatureCode(id: string, updates: Partial<FeatureCode>): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];
  const map: Record<string, string> = {
    description: 'description',
    layer: 'layer',
    color: 'color',
    icon: 'icon',
    isActive: 'is_active',
  };
  for (const [k, v] of Object.entries(updates)) {
    if (map[k]) {
      fields.push(`${map[k]} = ?`);
      values.push(v);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(`UPDATE feature_codes SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteFeatureCode(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM feature_codes WHERE id = ?`, [id]);
}

// ============================================================================
// Pre-load Kenya standard library on first project use
// ============================================================================
const KENYA_STANDARD_CODES: Omit<FeatureCode, 'id' | 'projectId' | 'createdAt' | 'isActive'>[] = [
  // Vegetation
  { code: 'TREE', description: 'Tree (deciduous)', layer: 'vegetation', color: '#10B981', icon: 'tree' },
  { code: 'TREEC', description: 'Tree (coniferous)', layer: 'vegetation', color: '#059669', icon: 'pine-tree' },
  { code: 'BUSH', description: 'Bush / shrub', layer: 'vegetation', color: '#16A34A', icon: 'leaf' },
  { code: 'GRASS', description: 'Grass area', layer: 'vegetation', color: '#65A30D', icon: 'grass' },
  { code: 'WOOD', description: 'Wooded area boundary', layer: 'vegetation', color: '#3F6212', icon: 'forest' },

  // Structures
  { code: 'BUILD', description: 'Building', layer: 'structures', color: '#F97316', icon: 'home' },
  { code: 'WALL', description: 'Wall', layer: 'structures', color: '#EA580C', icon: 'wall' },
  { code: 'FENCE', description: 'Fence', layer: 'structures', color: '#C2410C', icon: 'fence' },
  { code: 'GATE', description: 'Gate', layer: 'structures', color: '#9A3412', icon: 'gate' },
  { code: 'STEP', description: 'Steps / staircase', layer: 'structures', color: '#7C2D12', icon: 'stairs' },
  { code: 'PILL', description: 'Pillar / column', layer: 'structures', color: '#FB923C', icon: 'pillar' },

  // Transport
  { code: 'ROAD', description: 'Road edge', layer: 'transport', color: '#3B82F6', icon: 'road-variant' },
  { code: 'PATH', description: 'Path / footpath', layer: 'transport', color: '#60A5FA', icon: 'walk' },
  { code: 'TRACK', description: 'Track (unpaved)', layer: 'transport', color: '#2563EB', icon: 'road' },
  { code: 'BRIDGE', description: 'Bridge', layer: 'transport', color: '#1D4ED8', icon: 'bridge' },
  { code: 'CROSS', description: 'Road crossing', layer: 'transport', color: '#1E40AF', icon: 'crossroads' },
  { code: 'PKNG', description: 'Parking', layer: 'transport', color: '#1E3A8A', icon: 'car' },

  // Hydrology
  { code: 'RIVER', description: 'River edge', layer: 'hydrology', color: '#06B6D4', icon: 'waves' },
  { code: 'STREAM', description: 'Stream', layer: 'hydrology', color: '#0891B2', icon: 'water' },
  { code: 'POND', description: 'Pond', layer: 'hydrology', color: '#0E7490', icon: 'water-pump' },
  { code: 'SWAMP', description: 'Swamp / wetland', layer: 'hydrology', color: '#155E75', icon: 'wave' },
  { code: 'TANK', description: 'Water tank', layer: 'hydrology', color: '#164E63', icon: 'propane-tank' },

  // Utilities
  { code: 'POLE', description: 'Utility pole', layer: 'utilities', color: '#A21CAF', icon: 'transmission-tower' },
  { code: 'CABLE', description: 'Overhead cable', layer: 'utilities', color: '#C026D3', icon: 'cable-data' },
  { code: 'PIPE', description: 'Pipe / pipeline', layer: 'utilities', color: '#DB2777', icon: 'pipe' },
  { code: 'MANH', description: 'Manhole', layer: 'utilities', color: '#E11D48', icon: 'circle-multiple' },
  { code: 'FIRE', description: 'Fire hydrant', layer: 'utilities', color: '#BE123C', icon: 'fire-hydrant' },

  // General / control
  { code: 'CTRL', description: 'Control point', layer: 'general', color: '#000000', icon: 'crosshairs-gps' },
  { code: 'BM', description: 'Benchmark', layer: 'general', color: '#374151', icon: 'triangle' },
  { code: 'SPOT', description: 'Spot height', layer: 'contours', color: '#6B7280', icon: 'elevation-rise' },
  { code: 'TEXT', description: 'Annotation text', layer: 'general', color: '#9CA3AF', icon: 'format-text' },
];

/**
 * Ensure a project has the Kenya standard feature code library.
 * Called once per project (idempotent — skips existing codes).
 */
export async function ensureStandardCodes(projectId: string): Promise<void> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM feature_codes WHERE project_id = ?`,
    [projectId]
  );
  // Only seed if project has no codes yet
  if (existing && existing.count > 0) return;

  for (const fc of KENYA_STANDARD_CODES) {
    await createFeatureCode({ projectId, ...fc });
  }
}

// ============================================================================
// Layer metadata
// ============================================================================
export const FEATURE_LAYERS: { value: FeatureLayer; label: string; color: string; icon: string }[] = [
  { value: 'vegetation', label: 'Vegetation', color: '#10B981', icon: 'tree' },
  { value: 'structures', label: 'Structures', color: '#F97316', icon: 'home' },
  { value: 'transport', label: 'Transport', color: '#3B82F6', icon: 'road-variant' },
  { value: 'hydrology', label: 'Hydrology', color: '#06B6D4', icon: 'waves' },
  { value: 'utilities', label: 'Utilities', color: '#A21CAF', icon: 'transmission-tower' },
  { value: 'contours', label: 'Contours / Heights', color: '#6B7280', icon: 'elevation-rise' },
  { value: 'general', label: 'General / Control', color: '#374151', icon: 'crosshairs-gps' },
];

// ============================================================================
// Row mapper
// ============================================================================
function rowToFeatureCode(r: any): FeatureCode {
  return {
    id: r.id,
    projectId: r.project_id,
    code: r.code,
    description: r.description ?? undefined,
    layer: r.layer,
    color: r.color,
    icon: r.icon,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
  };
}
