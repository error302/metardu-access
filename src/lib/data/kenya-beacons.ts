/**
 * Kenya Beacon Reference Library — standard beacon types per Survey of Kenya.
 *
 * Used as a reference for surveyors in the field. Each beacon type has
 * specifications, dimensions, and typical use cases.
 *
 * Source: Survey of Kenya Field Manual, Survey Regulations 1994
 */

export interface BeaconTypeSpec {
  id: string;
  name: string;
  swahili: string;
  icon: string;
  color: string;
  dimensions: string;
  material: string;
  useCase: string;
  regulations: string;
  lifespan: string;
  cost: string;
}

export const KENYA_BEACON_TYPES: BeaconTypeSpec[] = [
  {
    id: 'concrete',
    name: 'Concrete Pillar',
    swahili: 'Nguzo ya Saruji',
    icon: 'cube-outline',
    color: '#F97316',
    dimensions: '150mm × 150mm × 900mm (above ground 100mm)',
    material: '1:3:6 concrete mix (cement:sand:ballast), steel reinforcement',
    useCase: 'Cadastral surveys, permanent boundary marks, control points',
    regulations: 'Survey Regulations 1994, Reg. 21(1) — standard for all cadastral work',
    lifespan: '50+ years',
    cost: 'KES 1,500-3,000 per beacon (materials + labor)',
  },
  {
    id: 'iron_pin',
    name: 'Iron Pin / Pipe',
    swahili: 'Bombwe ya Chuma',
    icon: 'nail',
    color: '#3B82F6',
    dimensions: '50mm diameter × 600mm length (galvanized iron pipe)',
    material: 'Galvanized iron pipe, capped, set in concrete base',
    useCase: 'Engineering surveys, temporary control, sectional property corners',
    regulations: 'Survey Regulations 1994, Reg. 21(2) — acceptable for engineering surveys',
    lifespan: '20-30 years (depending on soil conditions)',
    cost: 'KES 800-1,500 per beacon',
  },
  {
    id: 'stone',
    name: 'Cut Stone Beacon',
    swahili: 'Jiwe la Kukata',
    icon: 'gem-outline',
    color: '#10B981',
    dimensions: '300mm × 300mm × 600mm (cut dressed stone)',
    material: 'Hard granite or basalt, cut square, set in concrete foundation',
    useCase: 'Rural cadastral surveys where concrete is unavailable, historic boundaries',
    regulations: 'Survey Regulations 1994, Reg. 21(3) — traditional, still acceptable',
    lifespan: '100+ years (very durable)',
    cost: 'KES 2,000-4,000 per beacon (depends on stone availability)',
  },
  {
    id: 'natural',
    name: 'Natural Feature',
    swahili: 'Alama ya Asili',
    icon: 'tree',
    color: '#A21CAF',
    dimensions: 'Variable — large tree, rock outcrop, river confluence',
    material: 'Existing natural feature, marked with paint or blaze',
    useCase: 'Rural boundaries, forest surveys, low-value land, temporary marks',
    regulations: 'Survey Regulations 1994, Reg. 22 — only when no artificial beacon feasible',
    lifespan: 'Variable (trees may die, rivers may shift)',
    cost: 'KES 0 (but requires detailed description and photo evidence)',
  },
  {
    id: 'wall',
    name: 'Wall Mark',
    swahili: 'Alama ya Ukuta',
    icon: 'wall',
    color: '#EF4444',
    dimensions: '100mm × 100mm square, chiseled into existing wall',
    material: 'Cut into brick, stone, or concrete wall with chisel',
    useCase: 'Urban boundaries, sectional properties, party walls',
    regulations: 'Survey Regulations 1994, Reg. 23 — for urban subdivisions',
    lifespan: 'Depends on wall (50+ years if wall maintained)',
    cost: 'KES 500-1,000 per mark',
  },
  {
    id: 'bench',
    name: 'Benchmark (BM)',
    swahili: 'Alama ya Urefu',
    icon: 'triangle',
    color: '#6B7280',
    dimensions: 'Standard bronze tablet, 90mm diameter, set in concrete/rock',
    material: 'Bronze tablet, cemented into rock outcrop or concrete pillar',
    useCase: 'Vertical control, leveling runs, engineering projects',
    regulations: 'Survey Regulations 1994, Reg. 24 — vertical control network',
    lifespan: '100+ years (bronze is corrosion-resistant)',
    cost: 'KES 5,000-10,000 per benchmark (materials + installation)',
  },
];

export function getBeaconTypeById(id: string): BeaconTypeSpec | undefined {
  return KENYA_BEACON_TYPES.find(b => b.id === id);
}
