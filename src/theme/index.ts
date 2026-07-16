/**
 * Metardu Access — Design System v2
 *
 * Inspired by modern agentic apps (Linear, Vercel, Raycast, Cursor):
 *   - Tight letter-spacing on display headings
 *   - 4-8px spacing grid (consistent rhythm)
 *   - Subtle borders (1px, low contrast)
 *   - Status dots (not heavy badges)
 *   - Monospace for technical values (coordinates, IDs)
 *   - Generous whitespace
 *   - Variable font weights for hierarchy
 *
 * Three theme modes:
 *   - light: cream background, navy text (default indoor)
 *   - dark: deep navy, white text (night / low light)
 *   - outdoor: pure black, white text, max contrast (Kenya sun)
 */

// ============================================================================
// Brand colors (from Metardu logo analysis)
// ============================================================================
export const BrandColors = {
  metarduOrange: '#F97316',
  metarduOrangeLight: '#FB923C',
  metarduOrangeDark: '#EA580C',
  metarduNavy: '#0B1F3A',
  metarduNavyLight: '#1E3A5F',
  metarduNavyDark: '#061122',
  metarduWhite: '#FFFFFF',
  metarduCream: '#FAF7F2',
} as const;

// ============================================================================
// Semantic colors
// ============================================================================
export const SemanticColors = {
  success: '#10B981',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
} as const;

// ============================================================================
// Neutral palette (slightly cool — modern feel)
// ============================================================================
export const NeutralColors = {
  gray50: '#FAFAFA',
  gray100: '#F4F4F5',
  gray200: '#E4E4E7',
  gray300: '#D4D4D8',
  gray400: '#A1A1AA',
  gray500: '#71717A',
  gray600: '#52525B',
  gray700: '#3F3F46',
  gray800: '#27272A',
  gray900: '#18181B',
  gray950: '#09090B',
} as const;

// ============================================================================
// Theme color sets
// ============================================================================
export const LightColors = {
  bg: '#FAFAFA',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgSubtle: '#F4F4F5',
  fg: '#18181B',
  fgSecondary: '#3F3F46',
  fgMuted: '#71717A',
  fgSubtle: '#A1A1AA',
  border: '#E4E4E7',
  borderStrong: '#D4D4D8',
  inputBg: '#FFFFFF',
  inputBorder: '#E4E4E7',
  overlay: 'rgba(9, 9, 11, 0.4)',
} as const;

export const DarkColors = {
  bg: '#09090B',
  bgElevated: '#18181B',
  bgCard: '#18181B',
  bgSubtle: '#27272A',
  fg: '#FAFAFA',
  fgSecondary: '#D4D4D8',
  fgMuted: '#A1A1AA',
  fgSubtle: '#71717A',
  border: '#27272A',
  borderStrong: '#3F3F46',
  inputBg: '#18181B',
  inputBorder: '#3F3F46',
  overlay: 'rgba(0, 0, 0, 0.7)',
} as const;

export const OutdoorColors = {
  bg: '#000000',
  bgElevated: '#000000',
  bgCard: '#0A0A0A',
  bgSubtle: '#111111',
  fg: '#FFFFFF',
  fgSecondary: '#FFFFFF',
  fgMuted: '#CCCCCC',
  fgSubtle: '#999999',
  border: '#FFFFFF',
  borderStrong: '#FFFFFF',
  inputBg: '#111111',
  inputBorder: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.85)',
} as const;

// ============================================================================
// Typography (Inter variable font, modern scale)
// ============================================================================
export const Typography = {
  fontFamily: {
    sans: 'Inter',
    sansMedium: 'Inter-Medium',
    sansSemibold: 'Inter-SemiBold',
    sansBold: 'Inter-Bold',
    heading: 'Inter-SemiBold',
    mono: 'JetBrainsMono',
    monoMedium: 'JetBrainsMono-Medium',
  },
  // Modern type scale (1.250 ratio — Major Third)
  fontSize: {
    '2xs': 10,
    xs: 11,
    sm: 13,
    base: 15,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  // Letter spacing — tight on display, normal on body
  letterSpacing: {
    tight: -0.02,    // display headings
    snug: -0.01,     // subheadings
    normal: 0,       // body
    wide: 0.02,      // captions
    wider: 0.05,     // uppercase labels
    widest: 0.1,     // overlines
  },
  lineHeight: {
    tight: 1.2,      // headings
    snug: 1.35,      // subheadings
    normal: 1.5,     // body
    relaxed: 1.65,   // long-form
  },
} as const;

// ============================================================================
// Spacing (4px base, 8px primary rhythm)
// ============================================================================
export const Spacing = {
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,        // primary unit
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,       // primary unit
  5: 20,
  6: 24,
  7: 28,
  8: 32,       // primary unit
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

// ============================================================================
// Radii (consistent across components)
// ============================================================================
export const Radius = {
  none: 0,
  sm: 4,
  base: 6,
  md: 8,
  lg: 10,
  xl: 12,
  '2xl': 14,
  '3xl': 16,
  full: 9999,
} as const;

// ============================================================================
// Shadows (subtle, layered)
// ============================================================================
export const Shadows = {
  none: '0px 0px 0px transparent',
  xs: '0px 1px 2px rgba(9, 9, 11, 0.04)',
  sm: '0px 1px 3px rgba(9, 9, 11, 0.06), 0px 1px 2px rgba(9, 9, 11, 0.04)',
  md: '0px 4px 6px -1px rgba(9, 9, 11, 0.08), 0px 2px 4px -1px rgba(9, 9, 11, 0.04)',
  lg: '0px 10px 15px -3px rgba(9, 9, 11, 0.08), 0px 4px 6px -2px rgba(9, 9, 11, 0.04)',
  xl: '0px 20px 25px -5px rgba(9, 9, 11, 0.10), 0px 10px 10px -5px rgba(9, 9, 11, 0.04)',
} as const;

// ============================================================================
// Animation timings
// ============================================================================
export const Motion = {
  duration: {
    instant: 100,
    fast: 150,
    normal: 250,
    slow: 400,
    slower: 600,
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ============================================================================
// Theme types
// ============================================================================
export type ThemeMode = 'light' | 'dark' | 'outdoor';

export interface Theme {
  mode: ThemeMode;
  brand: typeof BrandColors;
  semantic: typeof SemanticColors;
  neutral: typeof NeutralColors;
  colors: typeof LightColors;
  typography: typeof Typography;
  spacing: typeof Spacing;
  radius: typeof Radius;
  shadows: typeof Shadows;
}

export function getTheme(mode: ThemeMode): Theme {
  const colors = mode === 'light' ? LightColors : mode === 'dark' ? DarkColors : OutdoorColors;
  return {
    mode,
    brand: BrandColors,
    semantic: SemanticColors,
    neutral: NeutralColors,
    colors,
    typography: Typography,
    spacing: Spacing,
    radius: Radius,
    shadows: Shadows,
  };
}

// ============================================================================
// Backward-compat flat Colors export
// ============================================================================
export const Colors = {
  ...BrandColors,
  ...SemanticColors,
  ...NeutralColors,
};

// ============================================================================
// Survey type configs (refined icon set)
// ============================================================================
export const SurveyTypeConfig: Record<
  string,
  { label: string; icon: string; color: string; shortCode: string; description: string }
> = {
  cadastral: {
    label: 'Cadastral',
    icon: 'map-marker-radius-outline',
    color: BrandColors.metarduOrange,
    shortCode: 'CAD',
    description: 'Boundary surveys · deed plans · NLIMS',
  },
  engineering: {
    label: 'Engineering',
    icon: 'ruler-square-compass-outline',
    color: SemanticColors.info,
    shortCode: 'ENG',
    description: 'Roads · leveling · setting out · earthworks',
  },
  topographic: {
    label: 'Topographic',
    icon: 'terrain',
    color: SemanticColors.success,
    shortCode: 'TOP',
    description: 'Feature survey · breaklines · GCPs',
  },
  sectional: {
    label: 'Sectional Properties',
    icon: 'home-city-outline',
    color: SemanticColors.warning,
    shortCode: 'SEC',
    description: 'Sectional Properties Act 2020',
  },
  geodetic: {
    label: 'Geodetic / Control',
    icon: 'crosshairs-gps',
    color: BrandColors.metarduNavy,
    shortCode: 'GEO',
    description: 'Control networks · CORS',
  },
  mining: {
    label: 'Mining',
    icon: 'pickaxe',
    color: NeutralColors.gray700,
    shortCode: 'MIN',
    description: 'Volumetric · underground',
  },
  hydrographic: {
    label: 'Hydrographic',
    icon: 'waves-arrow-up',
    color: SemanticColors.info,
    shortCode: 'HYD',
    description: 'Bathymetry · tide corrections',
  },
  drone: {
    label: 'Drone / UAV',
    icon: 'drone',
    color: BrandColors.metarduOrangeDark,
    shortCode: 'UAV',
    description: 'Photogrammetry · GCPs · RINEX',
  },
  deformation: {
    label: 'Deformation / Monitoring',
    icon: 'chart-line-variant',
    color: SemanticColors.danger,
    shortCode: 'DEF',
    description: 'Time-series analysis',
  },
};

export const SyncStatusConfig: Record<
  string,
  { label: string; color: string; icon: string; dotColor: string }
> = {
  pending: { label: 'Pending', color: NeutralColors.gray500, icon: 'circle-outline', dotColor: NeutralColors.gray400 },
  queued: { label: 'Queued', color: SemanticColors.warning, icon: 'cloud-upload-outline', dotColor: SemanticColors.warning },
  syncing: { label: 'Syncing', color: SemanticColors.info, icon: 'cloud-sync-outline', dotColor: SemanticColors.info },
  synced: { label: 'Synced', color: SemanticColors.success, icon: 'cloud-check-outline', dotColor: SemanticColors.success },
  failed: { label: 'Failed', color: SemanticColors.danger, icon: 'cloud-alert-outline', dotColor: SemanticColors.danger },
  conflict: { label: 'Conflict', color: SemanticColors.danger, icon: 'cloud-braces-outline', dotColor: SemanticColors.danger },
};

// ============================================================================
// Presence status (for multi-surveyor collaboration)
// ============================================================================
export const PresenceStatusConfig: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  online: { label: 'Online', color: SemanticColors.success, dotColor: SemanticColors.success },
  away: { label: 'Away', color: SemanticColors.warning, dotColor: SemanticColors.warning },
  offline: { label: 'Offline', color: NeutralColors.gray400, dotColor: NeutralColors.gray400 },
  capturing: { label: 'Capturing', color: SemanticColors.info, dotColor: SemanticColors.info },
};
