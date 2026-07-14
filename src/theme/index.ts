/**
 * Metardu Access — Design System Theme
 * Colors derived from the Metardu logo (analyzed via VLM).
 *
 * Three theme modes:
 *   - light: cream background, navy text (default indoor)
 *   - dark: navy-dark background, white text (night / low light)
 *   - outdoor: pure black background, white text, max contrast (Kenya sun)
 */

export const BrandColors = {
  metarduOrange: '#F97316',
  metarduOrangeLight: '#FB923C',
  metarduOrangeDark: '#EA580C',
  metarduNavy: '#0B1F3A',
  metarduNavyLight: '#1E3A5F',
  metarduNavyDark: '#061122',
  metarduWhite: '#FFFFFF',
  metarduCream: '#FAF7F2',
};

export const SemanticColors = {
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
};

export const NeutralColors = {
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
};

// Dark theme overrides (for dark mode)
export const DarkColors = {
  bg: '#061122',
  bgElevated: '#0B1F3A',
  bgCard: '#1E3A5F',
  fg: '#FFFFFF',
  fgSecondary: '#E5E7EB',
  fgMuted: '#9CA3AF',
  border: '#1E3A5F',
  inputBg: '#0B1F3A',
  inputBorder: '#1E3A5F',
};

// Outdoor theme overrides (for Kenya sun — max contrast)
export const OutdoorColors = {
  bg: '#000000',
  bgElevated: '#000000',
  bgCard: '#0A0A0A',
  fg: '#FFFFFF',
  fgSecondary: '#FFFFFF',
  fgMuted: '#CCCCCC',
  border: '#FFFFFF',
  inputBg: '#111111',
  inputBorder: '#FFFFFF',
};

// Light theme (default)
export const LightColors = {
  bg: '#FAF7F2',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  fg: '#0B1F3A',
  fgSecondary: '#1F2937',
  fgMuted: '#6B7280',
  border: '#E5E7EB',
  inputBg: '#FFFFFF',
  inputBorder: '#D1D5DB',
};

export type ThemeMode = 'light' | 'dark' | 'outdoor';

export interface Theme {
  mode: ThemeMode;
  brand: typeof BrandColors;
  semantic: typeof SemanticColors;
  neutral: typeof NeutralColors;
  colors: {
    bg: string;
    bgElevated: string;
    bgCard: string;
    fg: string;
    fgSecondary: string;
    fgMuted: string;
    border: string;
    inputBg: string;
    inputBorder: string;
  };
}

// Backward-compat: keep the original flat Colors export
// (used by existing screens — gradually migrate to useTheme())
export const Colors = {
  ...BrandColors,
  ...SemanticColors,
  ...NeutralColors,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48, // minimum touch target
} as const;

export const Radius = {
  sm: 6,
  base: 8,
  card: 12,
  lg: 16,
  sheet: 20,
  pill: 9999,
} as const;

export const Typography = {
  fontFamily: {
    sans: 'Inter',
    heading: 'InterDisplay',
    mono: 'JetBrainsMono',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    '2xl': 28,
    '3xl': 36,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export function getTheme(mode: ThemeMode): Theme {
  const colors = mode === 'light' ? LightColors : mode === 'dark' ? DarkColors : OutdoorColors;
  return {
    mode,
    brand: BrandColors,
    semantic: SemanticColors,
    neutral: NeutralColors,
    colors,
  };
}

export const SurveyTypeConfig: Record<
  string,
  { label: string; icon: string; color: string; shortCode: string }
> = {
  cadastral: {
    label: 'Cadastral',
    icon: 'map-marker',
    color: BrandColors.metarduOrange,
    shortCode: 'CAD',
  },
  engineering: {
    label: 'Engineering',
    icon: 'road-variant',
    color: SemanticColors.info,
    shortCode: 'ENG',
  },
  topographic: {
    label: 'Topographic',
    icon: 'terrain',
    color: SemanticColors.success,
    shortCode: 'TOP',
  },
  sectional: {
    label: 'Sectional Properties',
    icon: 'home-city',
    color: SemanticColors.warning,
    shortCode: 'SEC',
  },
  geodetic: {
    label: 'Geodetic / Control',
    icon: 'crosshairs-gps',
    color: BrandColors.metarduNavy,
    shortCode: 'GEO',
  },
  mining: {
    label: 'Mining',
    icon: 'pickaxe',
    color: NeutralColors.gray700,
    shortCode: 'MIN',
  },
  hydrographic: {
    label: 'Hydrographic',
    icon: 'waves',
    color: SemanticColors.info,
    shortCode: 'HYD',
  },
  drone: {
    label: 'Drone / UAV',
    icon: 'quadcopter',
    color: BrandColors.metarduOrangeDark,
    shortCode: 'UAV',
  },
  deformation: {
    label: 'Deformation / Monitoring',
    icon: 'chart-line',
    color: SemanticColors.danger,
    shortCode: 'DEF',
  },
};

export const SyncStatusConfig: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: 'Pending', color: NeutralColors.gray500, icon: 'circle-outline' },
  queued: { label: 'Queued', color: SemanticColors.warning, icon: 'cloud-upload' },
  syncing: { label: 'Syncing', color: SemanticColors.info, icon: 'sync' },
  synced: { label: 'Synced', color: SemanticColors.success, icon: 'cloud-check' },
  failed: { label: 'Failed', color: SemanticColors.danger, icon: 'alert-circle' },
  conflict: { label: 'Conflict', color: SemanticColors.danger, icon: 'alert-octagon' },
};
