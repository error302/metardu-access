/**
 * useThemeColors — reactive Colors object for screens.
 *
 * Returns an object with the SAME shape as the legacy `Colors` export,
 * but with bg/fg/border/etc. fields swapped based on the active theme
 * (light / dark / outdoor).
 *
 * Migration path for existing screens:
 *   BEFORE:
 *     import { Colors } from '@/theme';
 *     <View style={{ backgroundColor: Colors.metarduNavy }}>
 *
 *   AFTER:
 *     import { useThemeColors } from '@/hooks/useThemeColors';
 *     const Colors = useThemeColors();
 *     <View style={{ backgroundColor: Colors.metarduNavy }}>
 *
 * Only the import + a single `const Colors = useThemeColors()` line changes.
 * All `Colors.xxx` references in the file continue to work.
 *
 * Theme resolution:
 *   - outdoorMode setting = true → outdoor theme (max contrast, Kenya sun)
 *   - else, system color scheme: dark → dark theme, light → light theme
 *
 * The returned object includes ALL legacy color tokens (metarduOrange, gray500,
 * success, etc.) PLUS the theme-aware tokens (bg, fg, bgCard, border, etc.).
 * This means existing screens get theme awareness for free for any new tokens
 * they choose to use, while their old `Colors.metarduNavy` references still
 * work exactly as before.
 */

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  BrandColors,
  SemanticColors,
  NeutralColors,
  LightColors,
  DarkColors,
  OutdoorColors,
  type ThemeMode,
} from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';

export interface ThemeColors {
  // Brand (constant across themes)
  metarduOrange: string;
  metarduOrangeLight: string;
  metarduOrangeDark: string;
  metarduNavy: string;
  metarduNavyLight: string;
  metarduNavyDark: string;
  metarduWhite: string;
  metarduCream: string;

  // Semantic (constant across themes — they're already theme-aware by design)
  success: string;
  successLight: string;
  successBg: string;
  successBorder: string;
  warning: string;
  warningLight: string;
  warningBg: string;
  warningBorder: string;
  danger: string;
  dangerLight: string;
  dangerBg: string;
  dangerBorder: string;
  info: string;
  infoLight: string;
  infoBg: string;
  infoBorder: string;

  // Neutrals (constant across themes — used for accents, not backgrounds)
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  gray500: string;
  gray600: string;
  gray700: string;
  gray800: string;
  gray900: string;

  // Theme-aware tokens (these change based on light/dark/outdoor)
  bg: string;
  bgElevated: string;
  bgCard: string;
  bgSubtle: string;
  fg: string;
  fgSecondary: string;
  fgMuted: string;
  fgSubtle: string;
  border: string;
  borderStrong: string;
  inputBg: string;
  inputBorder: string;
  overlay: string;

  // Current mode (for conditional logic if needed)
  mode: ThemeMode;
  isDark: boolean;
  isOutdoor: boolean;
}

export function useThemeColors(): ThemeColors {
  const outdoorMode = useSettingsStore((s) => s.outdoorMode);
  const systemScheme = useColorScheme();

  return useMemo(() => {
    const mode: ThemeMode = outdoorMode
      ? 'outdoor'
      : systemScheme === 'dark'
        ? 'dark'
        : 'light';

    const themeColors = mode === 'light'
      ? LightColors
      : mode === 'dark'
        ? DarkColors
        : OutdoorColors;

    return {
      ...BrandColors,
      ...SemanticColors,
      ...NeutralColors,
      ...themeColors,
      mode,
      isDark: mode !== 'light',
      isOutdoor: mode === 'outdoor',
    };
  }, [outdoorMode, systemScheme]);
}
