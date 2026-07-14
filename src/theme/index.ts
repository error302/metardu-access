/**
 * Metardu Access — Design System Theme
 * Colors derived from the Metardu logo (analyzed via VLM).
 */

export const Colors = {
  // Brand
  metarduOrange: '#F97316',
  metarduOrangeLight: '#FB923C',
  metarduOrangeDark: '#EA580C',
  metarduNavy: '#0B1F3A',
  metarduNavyLight: '#1E3A5F',
  metarduNavyDark: '#061122',
  metarduWhite: '#FFFFFF',
  metarduCream: '#FAF7F2',

  // Semantic
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Neutral grays
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

export const SurveyTypeConfig: Record<
  string,
  { label: string; icon: string; color: string; shortCode: string }
> = {
  cadastral: {
    label: 'Cadastral',
    icon: 'map-marker',
    color: Colors.metarduOrange,
    shortCode: 'CAD',
  },
  engineering: {
    label: 'Engineering',
    icon: 'road-variant',
    color: Colors.info,
    shortCode: 'ENG',
  },
  topographic: {
    label: 'Topographic',
    icon: 'terrain',
    color: Colors.success,
    shortCode: 'TOP',
  },
  sectional: {
    label: 'Sectional Properties',
    icon: 'home-city',
    color: Colors.warning,
    shortCode: 'SEC',
  },
  geodetic: {
    label: 'Geodetic / Control',
    icon: 'crosshairs-gps',
    color: Colors.metarduNavy,
    shortCode: 'GEO',
  },
  mining: {
    label: 'Mining',
    icon: 'pickaxe',
    color: Colors.gray700,
    shortCode: 'MIN',
  },
  hydrographic: {
    label: 'Hydrographic',
    icon: 'waves',
    color: Colors.info,
    shortCode: 'HYD',
  },
  drone: {
    label: 'Drone / UAV',
    icon: 'quadcopter',
    color: Colors.metarduOrangeDark,
    shortCode: 'UAV',
  },
  deformation: {
    label: 'Deformation / Monitoring',
    icon: 'chart-line',
    color: Colors.danger,
    shortCode: 'DEF',
  },
};

export const SyncStatusConfig: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  pending: { label: 'Pending', color: Colors.gray500, icon: 'circle-outline' },
  queued: { label: 'Queued', color: Colors.warning, icon: 'cloud-upload' },
  syncing: { label: 'Syncing', color: Colors.info, icon: 'sync' },
  synced: { label: 'Synced', color: Colors.success, icon: 'cloud-check' },
  failed: { label: 'Failed', color: Colors.danger, icon: 'alert-circle' },
  conflict: { label: 'Conflict', color: Colors.danger, icon: 'alert-octagon' },
};
