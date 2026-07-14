/**
 * useTheme — reactive hook for the current theme.
 *
 * Returns a Theme object based on the settings store:
 *   - outdoorMode = true → outdoor theme (max contrast, Kenya sun)
 *   - else, follows system preference (dark at night, light by day)
 *
 * Components call `const { theme } = useTheme()` and use theme.colors.bg etc.
 * For backward compat, screens can still import Colors directly for brand colors.
 */

import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { getTheme, type Theme, type ThemeMode } from '@/theme';
import { useSettingsStore } from '@/stores/settingsStore';

export function useTheme(): { theme: Theme; mode: ThemeMode } {
  const outdoorMode = useSettingsStore((s) => s.outdoorMode);
  const systemScheme = useColorScheme();

  const mode: ThemeMode = outdoorMode
    ? 'outdoor'
    : systemScheme === 'dark'
      ? 'dark'
      : 'light';

  const theme = useMemo(() => getTheme(mode), [mode]);
  return { theme, mode };
}
